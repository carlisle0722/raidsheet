const sheetId = "default";
const redisStateKey = `raidsheet:state:${sheetId}`;
const redisUpdatedAtKey = `raidsheet:state:${sheetId}:updatedAt`;
const blobStatePath = "raidsheet/state/default.json";
const blobStatePrefix = "raidsheet/state/default-";
const blobAlbumPrefix = "raidsheet/albums/";
const blobImageRestoreVersion = 1;
const maxAlbumImages = 14;

export default async function handler(req, res) {
  const method = req.method ?? "GET";
  if (method !== "GET" && method !== "PUT" && method !== "PATCH") {
    sendJson(res, 405, { error: "지원하지 않는 요청입니다." });
    return;
  }

  const redis = getRedisConfig();
  if (!redis) {
    sendJson(res, 503, { error: "Redis 환경변수가 설정되지 않았습니다." });
    return;
  }

  try {
    const body = method === "GET" ? null : await readJsonBody(req);
    const payload = await handleRedisState(method, req, body, redis);
    sendJson(res, 200, { ...payload, storage: "redis" });
  } catch (error) {
    console.error(error);
    sendJson(res, 500, { error: "Redis 저장소 처리 중 오류가 발생했습니다." });
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

function getRedisConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return { url: url.replace(/\/+$/, ""), token };
}

async function handleRedisState(method, req, body, config) {
  const mode = getStateMode(req);

  if (method === "GET") {
    if (mode.versionOnly) {
      const updatedAt = await redisCommand(config, ["GET", redisUpdatedAtKey]);
      return { exists: Boolean(updatedAt), updatedAt: updatedAt ?? null };
    }

    let state = await readRedisState(config);
    if (mode.scope === "all") state = await restoreBlobImagesOnce(config, state);
    return formatStatePayload(state, mode);
  }

  if (method === "PATCH") {
    if (!Array.isArray(body?.raidPlans)) {
      return { ok: false, error: "수정할 레이드 편성 데이터가 없습니다." };
    }

    const previous = await readRedisState(config);
    const next = {
      ...previous,
      raidPlans: body.raidPlans,
      updatedAt: new Date().toISOString(),
    };
    await writeRedisState(config, next);
    return { ok: true, updatedAt: next.updatedAt };
  }

  const previous = await readRedisState(config);
  const next = {
    accounts: Array.isArray(body?.accounts) ? body.accounts : [],
    assignments: Array.isArray(body?.assignments) ? body.assignments : [],
    raidPlans: Array.isArray(body?.raidPlans) ? body.raidPlans : [],
    albumImages: Array.isArray(body?.albumImages) ? body.albumImages : [],
    memoNotes: Array.isArray(body?.memoNotes) ? body.memoNotes : [],
    migrations: previous.migrations,
    updatedAt: new Date().toISOString(),
  };
  await writeRedisState(config, next);
  return { ok: true, updatedAt: next.updatedAt };
}

async function restoreBlobImagesOnce(config, state) {
  if (state.migrations.blobImages >= blobImageRestoreVersion) return state;
  if (!process.env.BLOB_READ_WRITE_TOKEN) return state;

  let backup;
  try {
    backup = await readLatestBlobStateBackup();
  } catch (error) {
    console.error("Blob image restore failed", error);
    return state;
  }

  const restored = mergeBlobImages(state, backup?.state);
  const next = {
    ...state,
    accounts: restored.accounts,
    albumImages: restored.albumImages,
    migrations: {
      ...state.migrations,
      blobImages: blobImageRestoreVersion,
      blobImagesRestoredAt: new Date().toISOString(),
      blobImagesSource: backup?.pathname ?? null,
    },
    updatedAt: restored.changed ? new Date().toISOString() : state.updatedAt,
  };

  await writeRedisState(config, next);
  console.info("Blob image restore completed", {
    source: backup?.pathname ?? null,
    albumImagesRestored: restored.albumImagesRestored,
    profileImagesRestored: restored.profileImagesRestored,
  });
  return next;
}

async function readLatestBlobStateBackup() {
  const { head, list } = await import("@vercel/blob");
  const result = await list({ prefix: blobStatePrefix, limit: 100 });
  const candidates = getStateBlobsNewestFirst(result.blobs);

  try {
    const legacy = await head(blobStatePath);
    if (!candidates.some((blob) => blob.pathname === legacy.pathname)) candidates.push(legacy);
  } catch (error) {
    if (!isBlobNotFoundError(error)) throw error;
  }

  let newestReadableBackup = null;
  let imageBackup = null;
  for (const blob of candidates) {
    let backup;
    try {
      backup = await readBlobStateCandidate(blob);
    } catch (error) {
      console.warn("Skipping unreadable Blob state backup", blob.pathname, error);
      continue;
    }
    if (!newestReadableBackup) newestReadableBackup = backup;
    if (hasRemoteImages(backup.state)) {
      imageBackup = backup;
      break;
    }
  }

  if (normalizeAlbumImages(imageBackup?.state?.albumImages).length) return imageBackup;

  const albumResult = await list({ prefix: blobAlbumPrefix, limit: 100 });
  const albumImages = (Array.isArray(albumResult.blobs) ? albumResult.blobs : []).map((blob, index) => ({
    id: blob.pathname || `restored-album-${index}`,
    name: getBlobFileName(blob.pathname),
    url: blob.url,
  }));
  if (albumImages.length) {
    return {
      pathname: blobAlbumPrefix,
      state: normalizeState({ ...(imageBackup?.state ?? {}), albumImages }),
    };
  }

  return imageBackup ?? newestReadableBackup;
}

function getStateBlobsNewestFirst(blobs) {
  const candidates = Array.isArray(blobs) ? blobs.filter((blob) => blob.pathname?.startsWith(blobStatePrefix)) : [];
  candidates.sort((left, right) => String(right.pathname).localeCompare(String(left.pathname)));
  return candidates;
}

async function readBlobStateCandidate(blob) {
  const response = await fetch(`${blob.url}?t=${Date.now()}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`Blob state backup unavailable: ${response.status}`);
  return {
    pathname: blob.pathname ?? blobStatePath,
    state: normalizeState(await response.json()),
  };
}

function hasRemoteImages(state) {
  if (normalizeAlbumImages(state?.albumImages).length) return true;
  return Array.isArray(state?.accounts) && state.accounts.some((account) => isRemoteImageUrl(account?.avatarUrl));
}

function getBlobFileName(pathname) {
  const parts = String(pathname ?? "").split("/");
  return parts[parts.length - 1] ?? "";
}

function mergeBlobImages(currentState, backupState) {
  if (!backupState) {
    return {
      accounts: currentState.accounts,
      albumImages: currentState.albumImages,
      albumImagesRestored: 0,
      profileImagesRestored: 0,
      changed: false,
    };
  }

  const backupAccounts = Array.isArray(backupState.accounts) ? backupState.accounts : [];
  let profileImagesRestored = 0;
  const accounts = currentState.accounts.map((account) => {
    const backup = backupAccounts.find((candidate) => isSameAccount(account, candidate));
    const backupUrl = String(backup?.avatarUrl ?? "");
    const currentUrl = String(account?.avatarUrl ?? "");
    if (!isRemoteImageUrl(backupUrl) || isRemoteImageUrl(currentUrl)) return account;
    profileImagesRestored += 1;
    return { ...account, avatarUrl: backupUrl };
  });

  const currentAlbumUrls = new Set(normalizeAlbumImages(currentState.albumImages).map((image) => image.url));
  const albumImages = mergeAlbumImages(currentState.albumImages, backupState.albumImages);
  const albumImagesRestored = albumImages.filter((image) => !currentAlbumUrls.has(image.url)).length;
  const albumImagesChanged = JSON.stringify(albumImages) !== JSON.stringify(currentState.albumImages);
  return {
    accounts,
    albumImages,
    albumImagesRestored,
    profileImagesRestored,
    changed: albumImagesChanged || profileImagesRestored > 0,
  };
}

function isSameAccount(left, right) {
  if (!left || !right) return false;
  if (left.id && right.id && String(left.id) === String(right.id)) return true;
  return String(left.owner ?? "") === String(right.owner ?? "") && String(left.queryName ?? "") === String(right.queryName ?? "");
}

function mergeAlbumImages(currentImages, backupImages) {
  const merged = [];
  const seen = new Set();

  for (const image of [...normalizeAlbumImages(currentImages), ...normalizeAlbumImages(backupImages)]) {
    const key = image.id || image.url;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(image);
    if (merged.length >= maxAlbumImages) break;
  }

  return merged;
}

function normalizeAlbumImages(images) {
  if (!Array.isArray(images)) return [];
  return images
    .map((image, index) => {
      const url = String(image?.url ?? "");
      if (!isRemoteImageUrl(url)) return null;
      return {
        id: String(image?.id ?? `album-${index}`),
        name: String(image?.name ?? ""),
        url,
      };
    })
    .filter(Boolean);
}

function isRemoteImageUrl(value) {
  return /^https?:\/\//i.test(String(value ?? ""));
}

async function readRedisState(config) {
  const value = await redisCommand(config, ["GET", redisStateKey]);
  if (!value) return getEmptyState();
  return normalizeState(typeof value === "string" ? JSON.parse(value) : value);
}

async function writeRedisState(config, state) {
  const normalizedState = normalizeState(state);
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

function formatStatePayload(state, mode) {
  const exists = Boolean(state.updatedAt);
  if (mode.versionOnly) return { exists, updatedAt: state.updatedAt ?? null };
  if (mode.scope === "raid-plans") {
    return { exists, raidPlans: state.raidPlans, updatedAt: state.updatedAt ?? null };
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

function normalizeState(value) {
  const migrations = value?.migrations && typeof value.migrations === "object" ? value.migrations : {};
  return {
    accounts: Array.isArray(value?.accounts) ? value.accounts : [],
    assignments: Array.isArray(value?.assignments) ? value.assignments : [],
    raidPlans: Array.isArray(value?.raidPlans) ? value.raidPlans : [],
    albumImages: Array.isArray(value?.albumImages) ? value.albumImages : [],
    memoNotes: Array.isArray(value?.memoNotes) ? value.memoNotes : [],
    migrations,
    updatedAt: value?.updatedAt ?? null,
  };
}

function getEmptyState() {
  return normalizeState({});
}

function isBlobNotFoundError(error) {
  const message = String(error?.message ?? "");
  return error?.name === "BlobNotFoundError" || message.includes("not exist") || message.includes("404");
}

async function readJsonBody(req) {
  if (req.body && typeof req.body === "object") return req.body;

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
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
