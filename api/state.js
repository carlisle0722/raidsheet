import { neon } from "@neondatabase/serverless";

const sheetId = "default";

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

  if (method !== "GET" && method !== "PUT") {
    sendJson(res, 405, {
      error: "지원하지 않는 요청입니다.",
    });
    return;
  }

  try {
    const sql = neon(databaseUrl);
    await ensureTable(sql);

    if (method === "GET") {
      const rows = await sql`SELECT accounts, assignments, raid_plans, updated_at FROM raid_sheet_state WHERE sheet_id = ${sheetId}`;
      const row = rows[0];

      sendJson(res, 200, {
        exists: Boolean(row),
        accounts: Array.isArray(row?.accounts) ? row.accounts : null,
        assignments: Array.isArray(row?.assignments) ? row.assignments : null,
        raidPlans: Array.isArray(row?.raid_plans) ? row.raid_plans : null,
        updatedAt: row?.updated_at ?? null,
      });
      return;
    }

    const body = await readJsonBody(req);
    const accounts = Array.isArray(body?.accounts) ? body.accounts : [];
    const assignments = Array.isArray(body?.assignments) ? body.assignments : [];
    const raidPlans = Array.isArray(body?.raidPlans) ? body.raidPlans : [];

    await sql`
      INSERT INTO raid_sheet_state (sheet_id, accounts, assignments, raid_plans, updated_at)
      VALUES (${sheetId}, ${JSON.stringify(accounts)}::jsonb, ${JSON.stringify(assignments)}::jsonb, ${JSON.stringify(raidPlans)}::jsonb, NOW())
      ON CONFLICT (sheet_id)
      DO UPDATE SET
        accounts = EXCLUDED.accounts,
        assignments = EXCLUDED.assignments,
        raid_plans = EXCLUDED.raid_plans,
        updated_at = NOW()
    `;

    sendJson(res, 200, {
      ok: true,
    });
  } catch (error) {
    console.error(error);
    sendJson(res, 500, {
      error: "DB 저장소 처리 중 오류가 발생했습니다.",
    });
  }
}

async function ensureTable(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS raid_sheet_state (
      sheet_id TEXT PRIMARY KEY,
      accounts JSONB NOT NULL DEFAULT '[]'::jsonb,
      assignments JSONB NOT NULL DEFAULT '[]'::jsonb,
      raid_plans JSONB NOT NULL DEFAULT '[]'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`ALTER TABLE raid_sheet_state ADD COLUMN IF NOT EXISTS raid_plans JSONB NOT NULL DEFAULT '[]'::jsonb`;
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
