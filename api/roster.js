const apiBaseUrl = "https://developer-lostark.game.onstove.com";
const cacheTtlMs = 60_000;
const requestTimeoutMs = 10_000;
const cache = new Map();

const errorMessages = {
  400: "캐릭터명을 입력해 주세요.",
  401: "Lost Ark API 인증에 실패했습니다. Vercel 환경 변수의 LOSTARK_API_KEY 값을 확인해 주세요.",
  403: "Lost Ark API 접근 권한이 없습니다.",
  404: "해당 캐릭터를 찾지 못했습니다.",
  415: "요청 형식이 올바르지 않습니다.",
  429: "요청 제한에 도달했습니다. 잠시 후 다시 시도해 주세요.",
  500: "Lost Ark API 서버 오류입니다.",
  502: "Lost Ark API 게이트웨이 오류입니다.",
  503: "Lost Ark API가 점검 중이거나 일시적으로 사용할 수 없습니다.",
  504: "Lost Ark API 응답 시간이 초과되었습니다.",
};

export default async function handler(req, res) {
  const apiKey = process.env.LOSTARK_API_KEY?.trim();

  if (!apiKey) {
    sendJson(res, 500, {
      error: "LOSTARK_API_KEY가 설정되지 않았습니다. Vercel 프로젝트 환경 변수를 확인해 주세요.",
    });
    return;
  }

  const requestUrl = new URL(req.url ?? "/api/roster", `https://${req.headers.host ?? "localhost"}`);
  const characterName = String(req.query?.characterName ?? requestUrl.searchParams.get("characterName") ?? "").trim();
  const serverName = String(req.query?.serverName ?? requestUrl.searchParams.get("serverName") ?? "").trim();
  const forceRefresh = String(req.query?.refresh ?? requestUrl.searchParams.get("refresh") ?? "") === "1";

  if (!characterName) {
    sendJson(res, 400, { error: errorMessages[400] });
    return;
  }

  if (characterName.length > 20) {
    sendJson(res, 400, { error: "캐릭터명이 너무 깁니다." });
    return;
  }

  const cacheKey = `${characterName.toLocaleLowerCase("ko-KR")}:${serverName}`;
  const cached = cache.get(cacheKey);
  if (!forceRefresh && cached && Date.now() - cached.savedAt < cacheTtlMs) {
    sendJson(res, 200, {
      ...cached.payload,
      cached: true,
    });
    return;
  }

  const endpoint = `${apiBaseUrl}/characters/${encodeURIComponent(characterName)}/siblings`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
  let response;

  try {
    response = await fetch(endpoint, {
      headers: {
        accept: "application/json",
        authorization: `bearer ${apiKey}`,
      },
      signal: controller.signal,
    });
  } catch (error) {
    const isTimeout = error?.name === "AbortError";
    sendJson(res, 502, {
      error: isTimeout
        ? "Lost Ark API 응답 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요."
        : "Lost Ark API에 연결하지 못했습니다. 네트워크 상태를 확인해 주세요.",
    });
    return;
  } finally {
    clearTimeout(timeout);
  }

  const rateLimit = {
    limit: response.headers.get("x-ratelimit-limit"),
    remaining: response.headers.get("x-ratelimit-remaining"),
    reset: response.headers.get("x-ratelimit-reset"),
  };

  const data = await readResponseBody(response);

  if (!response.ok) {
    sendJson(res, response.status, {
      error: errorMessages[response.status] ?? "Lost Ark API 요청에 실패했습니다.",
      status: response.status,
      detail: data,
      rateLimit,
    });
    return;
  }

  const characters = Array.isArray(data) ? data : [];
  let normalizedCharacters = characters
    .map(normalizeCharacter)
    .sort((a, b) => b.itemLevelNumber - a.itemLevelNumber || a.characterName.localeCompare(b.characterName, "ko-KR"));

  if (serverName) {
    normalizedCharacters = normalizedCharacters.filter((character) => character.serverName === serverName);
  }

  const payload = {
    queriedCharacterName: characterName,
    serverName: serverName || null,
    total: normalizedCharacters.length,
    characters: normalizedCharacters,
    summary: summarizeRoster(normalizedCharacters),
    rateLimit,
    cached: false,
  };

  cache.set(cacheKey, {
    savedAt: Date.now(),
    payload,
  });

  sendJson(res, 200, payload);
}

async function readResponseBody(response) {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return response.json();
  }

  const text = await response.text();
  return text ? { message: text.slice(0, 500) } : null;
}

function normalizeCharacter(character) {
  const itemLevel = character.ItemAvgLevel ?? character.itemAvgLevel ?? "-";
  return {
    serverName: character.ServerName ?? character.serverName ?? "-",
    characterName: character.CharacterName ?? character.characterName ?? "-",
    characterLevel: character.CharacterLevel ?? character.characterLevel ?? null,
    characterClassName: character.CharacterClassName ?? character.characterClassName ?? "-",
    itemAvgLevel: itemLevel,
    itemMaxLevel: character.ItemMaxLevel ?? character.itemMaxLevel ?? itemLevel,
    itemLevelNumber: parseItemLevel(itemLevel),
  };
}

function summarizeRoster(characters) {
  const classCounts = new Map();
  const serverCounts = new Map();
  let highest = null;

  for (const character of characters) {
    classCounts.set(character.characterClassName, (classCounts.get(character.characterClassName) ?? 0) + 1);
    serverCounts.set(character.serverName, (serverCounts.get(character.serverName) ?? 0) + 1);
    if (!highest || character.itemLevelNumber > highest.itemLevelNumber) {
      highest = character;
    }
  }

  return {
    highest,
    classes: Array.from(classCounts, ([name, count]) => ({ name, count })).sort(
      (a, b) => b.count - a.count || a.name.localeCompare(b.name, "ko-KR"),
    ),
    servers: Array.from(serverCounts, ([name, count]) => ({ name, count })).sort(
      (a, b) => b.count - a.count || a.name.localeCompare(b.name, "ko-KR"),
    ),
  };
}

function parseItemLevel(value) {
  const number = Number(String(value ?? "0").replaceAll(",", ""));
  return Number.isFinite(number) ? number : 0;
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
