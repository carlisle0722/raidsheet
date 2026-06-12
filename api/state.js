import { neon } from "@neondatabase/serverless";

const sheetId = "default";
const redisStateKey = `raidsheet:state:${sheetId}`;
const redisUpdatedAtKey = `raidsheet:state:${sheetId}:updatedAt`;
const blobStatePath = "raidsheet/state/default.json";
const blobStatePrefix = "raidsheet/state/default-";
const blobStateKeepCount = 5;

export default async function handler(req, res) {
  const method = req.method ?? "GET";
  const databaseUrl =
    process.env.DATABASE_URL ??
    process.env.DATABASE_URL_URL ??
    process.env.DATABASE_URL_DATABASE_URL ??
    process.env.NEON_DATABASE_URL ??
    process.env.POSTGRES_URL ??
    process.env.POSTGRES_PRISMA_URL ??
    process.env.POSTGRES_URL_NON_POOLING ??
    process.env.DATABASE_URL_UNPOOLED;

  if (!databaseUrl) {
    sendJson(res, 503, {
      error: "DATABASE_URL이 설정되지 않았습니다.",
    });
    return;
  }

  if (method !== "GET" && method !== "PUT" && method !== "PATCH") {
    sendJson(res, 405, {
      error: "지원하지 않는 요청입니다.",
    });
    return;
  }

  let body = null;
  if (method !== "GET") {
    body = await readJsonBody(req);
  }

  const upstash = getUpstashConfig();
  if (upstash) {
    try {
      const payload = await handleUpstashState(method, req, body, upstash);
      sendJson(res, 200, { ...payload, storage: "upstash" });
      return;
    } catch (error) {
      console.error(error);
    }
  }

  try {
    const sql = neon(databaseUrl);
    await ensureTable(sql);

    if (method === "GET") {
      const mode = getStateMode(req);
      const rows =
        mode.scope === "raid-plans"
          ? await sql`SELECT raid_plans, updated_at FROM raid_sheet_state WHERE sheet_id = ${sheetId}`
          : await sql`SELECT accounts, assignments, raid_plans, album_images, memo_notes, updated_at FROM raid_sheet_state WHERE sheet_id = ${sheetId}`;
      const row = rows[0];

      if (mode.versionOnly) {
        sendJson(res, 200, {
          exists: Boolean(row),
          updatedAt: row?.updated_at ?? null,
        });
        return;
      }

      if (mode.scope === "raid-plans") {
        sendJson(res, 200, {
          exists: Boolean(row),
          raidPlans: Array.isArray(row?.raid_plans) ? row.raid_plans : null,
          updatedAt: row?.updated_at ?? null,
        });
        return;
      }

      sendJson(res, 200, {
        exists: Boolean(row),
        accounts: Array.isArray(row?.accounts) ? row.accounts : null,
        assignments: Array.isArray(row?.assignments) ? row.assignments : null,
        raidPlans: Array.isArray(row?.raid_plans) ? row.raid_plans : null,
        albumImages: Array.isArray(row?.album_images) ? row.album_images : null,
        memoNotes: Array.isArray(row?.memo_notes) ? row.memo_notes : null,
        updatedAt: row?.updated_at ?? null,
      });
      return;
    }

    if (method === "PATCH") {
      if (Array.isArray(body?.raidPlans)) {
        const rows = await sql`
          INSERT INTO raid_sheet_state (sheet_id, accounts, assignments, raid_plans, updated_at)
          VALUES (${sheetId}, '[]'::jsonb, '[]'::jsonb, ${JSON.stringify(body.raidPlans)}::jsonb, NOW())
          ON CONFLICT (sheet_id)
          DO UPDATE SET
            raid_plans = EXCLUDED.raid_plans,
            updated_at = NOW()
          RETURNING updated_at
        `;
        sendJson(res, 200, { ok: true, updatedAt: rows[0]?.updated_at ?? null });
        return;
      }

      sendJson(res, 400, {
        error: "수정할 레이드 편성 데이터가 없습니다.",
      });
      return;
    }

    const accounts = Array.isArray(body?.accounts) ? body.accounts : [];
    const assignments = Array.isArray(body?.assignments) ? body.assignments : [];
    const raidPlans = Array.isArray(body?.raidPlans) ? body.raidPlans : [];
    const albumImages = Array.isArray(body?.albumImages) ? body.albumImages : [];
    const memoNotes = Array.isArray(body?.memoNotes) ? body.memoNotes : [];

    const rows = await sql`
      INSERT INTO raid_sheet_state (sheet_id, accounts, assignments, raid_plans, album_images, memo_notes, updated_at)
      VALUES (${sheetId}, ${JSON.stringify(accounts)}::jsonb, ${JSON.stringify(assignments)}::jsonb, ${JSON.stringify(raidPlans)}::jsonb, ${JSON.stringify(albumImages)}::jsonb, ${JSON.stringify(memoNotes)}::jsonb, NOW())
      ON CONFLICT (sheet_id)
      DO UPDATE SET
        accounts = EXCLUDED.accounts,
        assignments = EXCLUDED.assignments,
        raid_plans = EXCLUDED.raid_plans,
        album_images = EXCLUDED.album_images,
        memo_notes = EXCLUDED.memo_notes,
        updated_at = NOW()
      RETURNING updated_at
    `;

    sendJson(res, 200, {
      ok: true,
      updatedAt: rows[0]?.updated_at ?? null,
    });
  } catch (error) {
    console.error(error);
    try {
      const fallbackPayload = await handleBlobFallback(method, req, body);
      sendJson(res, 200, { ...fallbackPayload, fallback: "blob" });
      return;
    } catch (fallbackError) {
      console.error(fallbackError);
    }
    sendJson(res, 500, {
      error: "DB 저장소 처리 중 오류가 발생했습니다.",
    });
  }
}

function getStateMode(req) {
  const query = req.query ?? {};
  const url = new URL(req.url ?? "/", "http://localhost");
  const scope = query.scope ?? url.searchParams.get("scope");
  const version = query.version ?? url.searchParams.get("version");

  return {
    scope: scope === "raid-plans" ? "raid-plans" : "all",
    versionOnly: version === "1" || version === "true",
  };
}

function getUpstashConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return { url: url.replace(/\/+$/, ""), token };
}

async function handleUpstashState(method, req, body, config) {
  const mode = getStateMode(req);

  if (method === "GET") {
    if (mode.versionOnly) {
      const updatedAt = await redisCommand(config, ["GET", redisUpdatedAtKey]);
      return {
        exists: Boolean(updatedAt),
        updatedAt: updatedAt ?? null,
      };
    }

    const state = await readRedisState(config);
    return formatStatePayload(state, mode);
  }

  if (method === "PATCH") {
    if (!Array.isArray(body?.raidPlans)) throw new Error("raidPlans is required");
    const previous = await readRedisState(config);
    const next = {
      ...previous,
      raidPlans: body.raidPlans,
      updatedAt: new Date().toISOString(),
    };
    await writeRedisState(config, next);
    return { ok: true, updatedAt: next.updatedAt };
  }

  const next = {
    accounts: Array.isArray(body?.accounts) ? body.accounts : [],
    assignments: Array.isArray(body?.assignments) ? body.assignments : [],
    raidPlans: Array.isArray(body?.raidPlans) ? body.raidPlans : [],
    albumImages: Array.isArray(body?.albumImages) ? body.albumImages : [],
    memoNotes: Array.isArray(body?.memoNotes) ? body.memoNotes : [],
    updatedAt: new Date().toISOString(),
  };
  await writeRedisState(config, next);
  return { ok: true, updatedAt: next.updatedAt };
}

async function readRedisState(config) {
  const value = await redisCommand(config, ["GET", redisStateKey]);
  if (!value) return getEmptyBlobState();
  return normalizeBlobState(typeof value === "string" ? JSON.parse(value) : value);
}

async function writeRedisState(config, state) {
  const normalizedState = normalizeBlobState(state);
  await redisCommand(config, ["SET", redisStateKey, JSON.stringify(normalizedState)]);
  await redisCommand(config, ["SET", redisUpdatedAtKey, normalizedState.updatedAt ?? ""]);
}

async function redisCommand(config, command) {
  const response = await fetch(config.url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${config.token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(command),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.error) {
    throw new Error(payload.error ?? `Upstash request failed: ${response.status}`);
  }
  return payload.result;
}

async function handleBlobFallback(method, req, body) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error("BLOB_READ_WRITE_TOKEN is not configured");
  }

  const mode = getStateMode(req);

  if (method === "GET") {
    const state = await readBlobState();
    return formatStatePayload(state, mode);
  }

  if (method === "PATCH") {
    if (!Array.isArray(body?.raidPlans)) throw new Error("raidPlans is required");
    const previous = await readBlobState();
    const next = {
      ...previous,
      raidPlans: body.raidPlans,
      updatedAt: new Date().toISOString(),
    };
    await writeBlobState(next);
    return { ok: true, updatedAt: next.updatedAt };
  }

  const next = {
    accounts: Array.isArray(body?.accounts) ? body.accounts : [],
    assignments: Array.isArray(body?.assignments) ? body.assignments : [],
    raidPlans: Array.isArray(body?.raidPlans) ? body.raidPlans : [],
    albumImages: Array.isArray(body?.albumImages) ? body.albumImages : [],
    memoNotes: Array.isArray(body?.memoNotes) ? body.memoNotes : [],
    updatedAt: new Date().toISOString(),
  };
  await writeBlobState(next);
  return { ok: true, updatedAt: next.updatedAt };
}

async function readBlobState() {
  const { head, list } = await import("@vercel/blob");

  try {
    const blobs = await list({ prefix: blobStatePrefix, limit: 100 });
    const latestBlob = getLatestStateBlob(blobs.blobs);
    const blob = latestBlob ?? (await head(blobStatePath));
    const response = await fetch(`${blob.url}?t=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`Blob state unavailable: ${response.status}`);
    return normalizeBlobState(await response.json());
  } catch (error) {
    if (isBlobNotFoundError(error)) return getEmptyBlobState();
    throw error;
  }
}

async function writeBlobState(state) {
  const { put } = await import("@vercel/blob");
  const pathname = `${blobStatePrefix}${Date.now()}.json`;
  await put(pathname, JSON.stringify(normalizeBlobState(state)), {
    access: "public",
    addRandomSuffix: false,
    contentType: "application/json; charset=utf-8",
    cacheControlMaxAge: 60,
  });
  await pruneOldBlobStates();
}

function getLatestStateBlob(blobs) {
  const candidates = Array.isArray(blobs) ? blobs.filter((blob) => blob.pathname?.startsWith(blobStatePrefix)) : [];
  candidates.sort((left, right) => String(right.pathname).localeCompare(String(left.pathname)));
  return candidates[0] ?? null;
}

async function pruneOldBlobStates() {
  const { del, list } = await import("@vercel/blob");
  const blobs = await list({ prefix: blobStatePrefix, limit: 100 });
  const candidates = Array.isArray(blobs.blobs) ? [...blobs.blobs] : [];
  candidates.sort((left, right) => String(right.pathname).localeCompare(String(left.pathname)));
  const stalePathnames = candidates.slice(blobStateKeepCount).map((blob) => blob.pathname).filter(Boolean);
  if (stalePathnames.length) await del(stalePathnames);
}

function formatStatePayload(state, mode) {
  const exists = Boolean(state.updatedAt);

  if (mode.versionOnly) {
    return {
      exists,
      updatedAt: state.updatedAt ?? null,
    };
  }

  if (mode.scope === "raid-plans") {
    return {
      exists,
      raidPlans: state.raidPlans,
      updatedAt: state.updatedAt ?? null,
    };
  }

  return {
    exists,
    accounts: state.accounts,
    assignments: state.assignments,
    raidPlans: state.raidPlans,
    albumImages: state.albumImages,
    memoNotes: state.memoNotes,
    updatedAt: state.updatedAt ?? null,
  };
}

function normalizeBlobState(value) {
  return {
    accounts: Array.isArray(value?.accounts) ? value.accounts : [],
    assignments: Array.isArray(value?.assignments) ? value.assignments : [],
    raidPlans: Array.isArray(value?.raidPlans) ? value.raidPlans : [],
    albumImages: Array.isArray(value?.albumImages) ? value.albumImages : [],
    memoNotes: Array.isArray(value?.memoNotes) ? value.memoNotes : [],
    updatedAt: value?.updatedAt ?? null,
  };
}

function getEmptyBlobState() {
  return normalizeBlobState({});
}

function isBlobNotFoundError(error) {
  const message = String(error?.message ?? "");
  return error?.name === "BlobNotFoundError" || message.includes("not exist") || message.includes("404");
}

async function ensureTable(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS raid_sheet_state (
      sheet_id TEXT PRIMARY KEY,
      accounts JSONB NOT NULL DEFAULT '[]'::jsonb,
      assignments JSONB NOT NULL DEFAULT '[]'::jsonb,
      raid_plans JSONB NOT NULL DEFAULT '[]'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      album_images JSONB NOT NULL DEFAULT '[]'::jsonb,
      memo_notes JSONB NOT NULL DEFAULT '[]'::jsonb
    )
  `;
  await sql`ALTER TABLE raid_sheet_state ADD COLUMN IF NOT EXISTS raid_plans JSONB NOT NULL DEFAULT '[]'::jsonb`;
  await sql`ALTER TABLE raid_sheet_state ADD COLUMN IF NOT EXISTS album_images JSONB NOT NULL DEFAULT '[]'::jsonb`;
  await sql`ALTER TABLE raid_sheet_state ADD COLUMN IF NOT EXISTS memo_notes JSONB NOT NULL DEFAULT '[]'::jsonb`;
}

async function readJsonBody(req) {
  if (req.body && typeof req.body === "object") {
    return req.body;
  }

  const chunks = [];

  for await (const chunk of req) {
    chunks.push(chunk);
  }

  const text = Buffer.concat(chunks).toString("utf-8");
  return text ? JSON.parse(text) : {};
}

function sendJson(res, statusCode, payload) {
  if (typeof res.status === "function") {
    res.status(statusCode).json(payload);
    return;
  }

  res.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(JSON.stringify(payload));
}
