import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const port = Number(process.env.PORT || 4173);

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8"
};

function parseEnv(raw) {
  return raw.split("\n").reduce((acc, line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      return acc;
    }

    const separator = trimmed.indexOf("=");
    if (separator === -1) {
      return acc;
    }

    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();

    if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    acc[key] = value;
    return acc;
  }, {});
}

async function getEnv() {
  const envPath = path.join(__dirname, ".env.local");
  if (!existsSync(envPath)) {
    return {};
  }

  const raw = await readFile(envPath, "utf8");
  return parseEnv(raw);
}

function resolveRoute(urlPath) {
  const cleanPath = urlPath.split("?")[0];

  if (cleanPath === "/api/auth-config") {
    return { type: "auth" };
  }

  if (cleanPath === "/" || cleanPath === "") {
    return { type: "file", filePath: path.join(__dirname, "index.html") };
  }

  if (cleanPath === "/apps" || cleanPath === "/apps/") {
    return { type: "file", filePath: path.join(__dirname, "apps/index.html") };
  }

  if (cleanPath === "/apps/aviadex" || cleanPath === "/apps/aviadex/") {
    return { type: "file", filePath: path.join(__dirname, "apps/aviadex/index.html") };
  }

  if (cleanPath === "/apps/todo" || cleanPath === "/apps/todo/") {
    return { type: "file", filePath: path.join(__dirname, "apps/todo/index.html") };
  }

  const relativePath = cleanPath.replace(/^\/+/, "");
  return { type: "file", filePath: path.join(__dirname, relativePath) };
}

async function serveFile(filePath, res) {
  try {
    const data = await readFile(filePath);
    const extension = path.extname(filePath).toLowerCase();
    res.writeHead(200, { "Content-Type": MIME_TYPES[extension] || "application/octet-stream" });
    res.end(data);
  } catch (_error) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
  }
}

const server = createServer(async (req, res) => {
  const route = resolveRoute(req.url || "/");

  if (route.type === "auth") {
    const env = await getEnv();
    const payload = {
      supabaseUrl: env.SUPABASE_URL || "",
      supabaseAnonKey: env.SUPABASE_ANON_KEY || ""
    };

    res.writeHead(200, {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "no-store"
    });
    res.end(`window.AUTH_CONFIG = ${JSON.stringify(payload)};`);
    return;
  }

  await serveFile(route.filePath, res);
});

server.listen(port, "127.0.0.1", () => {
  console.log(`mgcom local server running at http://127.0.0.1:${port}`);
});
