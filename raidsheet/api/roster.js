const apiBaseUrl = "https://developer-lostark.game.onstove.com";
const cacheTtlMs = 60_000;
const requestTimeoutMs = 10_000;
const cache = new Map();

const errorMessages = {
  400: "캐릭터명을 입력해 주세요.",
  401: "API 키 인증에 실패했습니다. Vercel 환경변수의 LOSTARK_API_KEY 값을 확인해 주세요.",
  403: "API 접근 권한이 없습니다.",
  404: "해당 캐릭터를 찾지 못했습니다.",
  415: "요청 형식이 올바르지 않습니다.",
  429: "요청 제한에 도달했습니다. 잠시 후 다시 시도해 주세요.",
  500: "로스트아크 API 서버 내부 오류입니다.",
  502: "로스트아크 API 게이트웨이 오류입니다.",
  503: "로스트아크 API가 점검 중이거나 일시적으로 사용할 수 없습니다.",
  504: "로스트아크 API 응답 시간이 초과되었습니다.",
};

export async function GET(request) {
  const apiKey = process.env.LOSTARK_API_KEY?.trim();

  if (!apiKey) {
    return json(
      {
        error: "LOSTARK_API_KEY가 설정되지 않았습니다. Vercel 프로젝트 환경변수를 확인해 주세요.",
      },
      500,
    );
  }

  const url = new URL(request.url);
  const characterName = url.searchParams.get("characterName")?.trim();
  const forceRefresh = url.searchParams.get("refresh") === "1";

  if (!characterName) {
    return json({ error: errorMessages[400] }, 400);
  }

  if (characterName.length > 20) {
    return json({ error: "캐릭터명이 너무 깁니다." }, 400);
  }

  const cacheKey = characterName.toLocaleLowerCase("ko-KR");
  const cached = cache.get(cacheKey);
  if (!forceRefresh && cached && Date.now() - cached.savedAt < cacheTtlMs) {
    return json({
      ...cached.payload,
      cached: true,
    });
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
    return json(
      {
        error: isTimeout
          ? "로스트아크 API 응답 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요."
          : "로스트아크 API에 연결하지 못했습니다. 네트워크 상태를 확인해 주세요.",
      },
      502,
    );
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
    return json(
      {
        error: errorMessages[response.status] ?? "로스트아크 API 요청에 실패했습니다.",
        status: response.status,
        detail: data,
        rateLimit,
      },
      response.status,
    );
  }

  const characters = Array.isArray(data) ? data : [];
  const normalizedCharacters = characters
    .map(normalizeCharacter)
    .sort((a, b) => b.itemLevelNumber - a.itemLevelNumber || a.characterName.localeCompare(b.characterName, "ko-KR"));

  const payload = {
    queriedCharacterName: characterName,
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

  return json(payload);
}

export default async function handler(request) {
  return GET(request);
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
    classes: Array.from(classCounts, ([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "ko-KR")),
    servers: Array.from(serverCounts, ([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "ko-KR")),
  };
}

function parseItemLevel(value) {
  const number = Number(String(value ?? "0").replaceAll(",", ""));
  return Number.isFinite(number) ? number : 0;
}

function json(payload, status = 200) {
  return Response.json(payload, {
    status,
    headers: {
      "cache-control": "no-store",
    },
  });
}
