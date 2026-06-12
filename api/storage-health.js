export default async function handler(req, res) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  const result = {
    hasUpstashUrl: Boolean(url),
    hasUpstashToken: Boolean(token),
    upstashOk: false,
  };

  if (!url || !token) {
    sendJson(res, 200, result);
    return;
  }

  try {
    const response = await fetch(url.replace(/\/+$/, ""), {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(["PING"]),
    });
    const payload = await response.json().catch(() => ({}));
    result.upstashOk = response.ok && !payload.error;
    result.status = response.status;
    if (payload.error) result.error = String(payload.error).slice(0, 160);
    if (payload.result) result.result = payload.result;
  } catch (error) {
    result.error = String(error?.message ?? error).slice(0, 160);
  }

  sendJson(res, 200, result);
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
