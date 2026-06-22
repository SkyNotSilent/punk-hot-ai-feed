import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildReport, loadSeedDataset, refreshFromSources } from "./data-pipeline.mjs";
import { openCache } from "./cache.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const distDir = path.join(rootDir, "dist");
const port = Number(process.env.PORT || 4173);
const refreshMinutes = Number(process.env.REFRESH_INTERVAL_MINUTES || 60);
const refreshToken = process.env.REFRESH_TOKEN || "";

const cache = openCache();
let refreshInFlight = null;

await bootstrap();

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
    if (url.pathname.startsWith("/api/")) {
      await handleApi(request, response, url);
      return;
    }
    serveStatic(response, url.pathname);
  } catch (error) {
    sendJson(response, 500, { ok: false, error: error.message });
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Punk Hot server listening on http://0.0.0.0:${port}`);
});

if (refreshMinutes > 0) {
  setInterval(() => {
    runRefresh().catch((error) => console.error("[refresh]", error));
  }, refreshMinutes * 60 * 1000).unref();
}

async function bootstrap() {
  const seed = await loadSeedDataset();
  cache.upsertSources(seed.sources);
  cache.upsertStories(seed.stories);
  cache.setMeta("bootedAt", new Date().toISOString());
  if (process.env.STARTUP_REFRESH !== "false") {
    setTimeout(() => runRefresh().catch((error) => console.error("[startup-refresh]", error)), 1500).unref();
  }
}

async function handleApi(request, response, url) {
  if (request.method === "GET" && url.pathname === "/api/health") {
    sendJson(response, 200, { ok: true, ...cache.stats() });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/sources") {
    sendJson(response, 200, { ok: true, sources: cache.listSources(), stats: cache.stats() });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/stories") {
    sendJson(response, 200, {
      ok: true,
      stories: cache.listStories({
        category: url.searchParams.get("category") || "",
        q: url.searchParams.get("q") || "",
        limit: Number(url.searchParams.get("limit") || 120),
      }),
      stats: cache.stats(),
    });
    return;
  }

  if (request.method === "GET" && url.pathname.startsWith("/api/reports/")) {
    const range = url.pathname.split("/").pop();
    sendJson(response, 200, { ok: true, report: buildReport(cache.listStories({ limit: 200 }), range) });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/refresh") {
    if (refreshToken && request.headers.authorization !== `Bearer ${refreshToken}`) {
      sendJson(response, 401, { ok: false, error: "Missing or invalid REFRESH_TOKEN" });
      return;
    }
    const result = await runRefresh();
    sendJson(response, 200, { ok: true, ...result });
    return;
  }

  sendJson(response, 404, { ok: false, error: "Not found" });
}

async function runRefresh() {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    const startedAt = new Date().toISOString();
    const currentSources = cache.listSources();
    const refreshed = await refreshFromSources(currentSources);
    cache.upsertSources(refreshed.sources);
    if (refreshed.stories.length) cache.upsertStories(refreshed.stories);
    const finishedAt = new Date().toISOString();
    cache.setMeta("lastRefreshAt", finishedAt);
    return {
      startedAt,
      finishedAt,
      refreshedSourceCount: refreshed.checkedSourceCount,
      fetchedStoryCount: refreshed.stories.length,
      stats: cache.stats(),
    };
  })().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

function serveStatic(response, requestPath) {
  const cleanPath = decodeURIComponent(requestPath.split("?")[0]);
  const targetPath = cleanPath === "/" ? "/index.html" : cleanPath;
  const filePath = path.normalize(path.join(distDir, targetPath));
  if (!filePath.startsWith(distDir)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }
  const existingPath = fs.existsSync(filePath) && fs.statSync(filePath).isFile() ? filePath : path.join(distDir, "index.html");
  if (!fs.existsSync(existingPath)) {
    response.writeHead(503, { "content-type": "text/plain; charset=utf-8" });
    response.end("Run npm run build before starting the server.");
    return;
  }
  response.writeHead(200, { "content-type": contentType(existingPath), "cache-control": cacheControl(existingPath) });
  fs.createReadStream(existingPath).pipe(response);
}

function sendJson(response, status, payload) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "access-control-allow-origin": "*",
  });
  response.end(JSON.stringify(payload));
}

function contentType(filePath) {
  const ext = path.extname(filePath);
  return (
    {
      ".html": "text/html; charset=utf-8",
      ".js": "text/javascript; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".json": "application/json; charset=utf-8",
      ".svg": "image/svg+xml",
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".ico": "image/x-icon",
    }[ext] || "application/octet-stream"
  );
}

function cacheControl(filePath) {
  return filePath.includes(`${path.sep}assets${path.sep}`) ? "public, max-age=31536000, immutable" : "no-cache";
}
