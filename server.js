import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { extname, join, normalize, relative } from "node:path";
import { fileURLToPath } from "node:url";
import healthHandler from "./api/health.js";
import rosterHandler from "./api/roster.js";
import stateHandler from "./api/state.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const publicDir = __dirname;

loadEnvFile(".env");
loadEnvFile(".env.local");

const port = Number(process.env.PORT || 5173);

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", `http://${req.headers.host}`);

    if (url.pathname === "/api/roster") {
      await rosterHandler(req, res);
      return;
    }

    if (url.pathname === "/api/state") {
      await stateHandler(req, res);
      return;
    }

    if (url.pathname === "/api/health") {
      healthHandler(req, res);
      return;
    }

    await serveStatic(url.pathname, res);
  } catch (error) {
    console.error(error);
    sendJson(res, 500, {
      error: "서버에서 예상하지 못한 오류가 발생했습니다.",
    });
  }
});

server.listen(port, () => {
  console.log(`Lost Ark roster search is running at http://localhost:${port}`);
});

async function serveStatic(pathname, res) {
  const safePath = pathname === "/" ? "/index.html" : pathname;
  const requestedPath = normalize(join(publicDir, safePath));
  const publicRoot = normalize(publicDir);
  const relativePath = relative(publicRoot, requestedPath);

  if (safePath.startsWith("/api/") || safePath.startsWith("/.")) {
    sendText(res, 404, "Not Found");
    return;
  }

  if (relativePath.startsWith("..") || relativePath === "..") {
    sendText(res, 403, "Forbidden");
    return;
  }

  try {
    const content = await readFile(requestedPath);
    const contentType = mimeTypes[extname(requestedPath)] ?? "application/octet-stream";
    res.writeHead(200, {
      "content-type": contentType,
      "cache-control": "no-store",
    });
    res.end(content);
  } catch {
    const fallback = await readFile(join(publicDir, "index.html"));
    res.writeHead(200, {
      "content-type": mimeTypes[".html"],
      "cache-control": "no-store",
    });
    res.end(fallback);
  }
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(JSON.stringify(payload));
}

function sendText(res, statusCode, text) {
  res.writeHead(statusCode, {
    "content-type": "text/plain; charset=utf-8",
  });
  res.end(text);
}

function loadEnvFile(fileName) {
  const filePath = join(__dirname, fileName);
  if (!existsSync(filePath)) {
    return;
  }

  const lines = readFileSync(filePath, "utf-8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    const value = rawValue.replace(/^["']|["']$/g, "");
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}
