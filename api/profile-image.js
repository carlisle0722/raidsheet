const maxImageBytes = 4 * 1024 * 1024;
const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export default async function handler(req, res) {
  const method = req.method ?? "GET";

  if (method !== "POST") {
    sendJson(res, 405, { error: "POST 요청만 지원합니다." });
    return;
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    sendJson(res, 503, {
      error: "BLOB_READ_WRITE_TOKEN이 설정되어 있지 않습니다.",
    });
    return;
  }

  try {
    const body = await readJsonBody(req);
    const fileName = sanitizeFileName(body?.fileName);
    const contentType = String(body?.contentType ?? "").trim().toLowerCase();
    const dataUrl = String(body?.dataUrl ?? "");

    if (!fileName || !allowedTypes.has(contentType) || !dataUrl.startsWith("data:image/")) {
      sendJson(res, 400, { error: "이미지 파일만 업로드할 수 있습니다." });
      return;
    }

    const commaIndex = dataUrl.indexOf(",");
    const base64 = commaIndex >= 0 ? dataUrl.slice(commaIndex + 1) : "";
    const buffer = Buffer.from(base64, "base64");

    if (!buffer.length || buffer.length > maxImageBytes) {
      sendJson(res, 400, { error: "이미지는 4MB 이하만 업로드할 수 있습니다." });
      return;
    }

    const { put } = await import("@vercel/blob");
    const extension = getExtension(fileName, contentType);
    const blob = await put(`raidsheet/profiles/${crypto.randomUUID()}${extension}`, buffer, {
      access: "public",
      contentType,
      addRandomSuffix: false,
    });

    sendJson(res, 200, {
      url: blob.url,
    });
  } catch (error) {
    console.error(error);
    sendJson(res, 500, { error: "프로필 사진 업로드 중 오류가 발생했습니다." });
  }
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

function sanitizeFileName(value) {
  return String(value ?? "")
    .trim()
    .replace(/[^\w.-]+/g, "-")
    .slice(0, 120);
}

function getExtension(fileName, contentType) {
  const match = fileName.match(/\.(jpe?g|png|webp|gif)$/i);
  if (match) return match[0].toLowerCase();

  if (contentType === "image/jpeg") return ".jpg";
  if (contentType === "image/png") return ".png";
  if (contentType === "image/webp") return ".webp";
  if (contentType === "image/gif") return ".gif";
  return ".png";
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
