import { spawn } from "node:child_process";

const port = Number(process.env.SMOKE_PORT || 4188);
const baseUrl = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ["server/index.mjs"], {
  env: {
    ...process.env,
    PORT: String(port),
    DB_PATH: `.data/smoke-${port}.sqlite`,
    STARTUP_REFRESH: "false",
    REFRESH_INTERVAL_MINUTES: "0",
  },
  stdio: ["ignore", "pipe", "pipe"],
});

const logs = [];
server.stdout.on("data", (chunk) => logs.push(chunk.toString()));
server.stderr.on("data", (chunk) => logs.push(chunk.toString()));

try {
  await waitFor(`${baseUrl}/api/health`);
  const [health, stories, sources, report] = await Promise.all([
    getJson(`${baseUrl}/api/health`),
    getJson(`${baseUrl}/api/stories?limit=20`),
    getJson(`${baseUrl}/api/sources`),
    getJson(`${baseUrl}/api/reports/daily`),
  ]);

  if (!health.ok || health.storyCount < 10 || health.sourceCount < 20) throw new Error("Health payload is incomplete");
  if (!stories.ok || stories.stories.length < 10) throw new Error("Stories API returned too few stories");
  if (!sources.ok || sources.sources.length < 20) throw new Error("Sources API returned too few sources");
  if (!report.ok || !report.report?.topStories?.length) throw new Error("Report API did not return top stories");

  console.log(
    JSON.stringify(
      {
        ok: true,
        health,
        stories: stories.stories.length,
        sources: sources.sources.length,
        reportTopStories: report.report.topStories.length,
      },
      null,
      2,
    ),
  );
} finally {
  server.kill("SIGTERM");
}

async function waitFor(url) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 15000) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Wait for the server to bind.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Server did not become ready. Logs:\n${logs.join("")}`);
}

async function getJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response.json();
}
