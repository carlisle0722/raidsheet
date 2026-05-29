export default function handler(req, res) {
  sendJson(res, 200, {
    ok: true,
    hasApiKey: Boolean(process.env.LOSTARK_API_KEY?.trim()),
  });
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
