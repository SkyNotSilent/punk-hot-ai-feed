import fs from "node:fs/promises";
import { fetchText, parseFeed } from "./feed-utils.mjs";

const sourcePath = new URL("../public/data/sources.json", import.meta.url);
const sources = JSON.parse(await fs.readFile(sourcePath, "utf8"));

const updated = [];
for (const source of sources) {
  if (!source.enabled || !source.url || source.fetchStrategy === "manual") {
    updated.push({
      ...source,
      verified: false,
      status: source.enabled ? "skipped" : "disabled",
      lastCheckedAt: new Date().toISOString(),
    });
    continue;
  }

  try {
    const { response, text } = await fetchText(source.url);
    const items = response.ok ? parseFeed(text) : [];
    const verified = response.ok && items.length > 0;
    updated.push({
      ...source,
      verified,
      status: response.status,
      itemCount: items.length,
      lastCheckedAt: new Date().toISOString(),
      lastError: verified ? "" : `No feed items parsed from ${response.status}`,
    });
    console.log(`${verified ? "OK" : "WARN"} ${source.id} ${response.status} items=${items.length}`);
  } catch (error) {
    updated.push({
      ...source,
      verified: false,
      status: "error",
      itemCount: 0,
      lastCheckedAt: new Date().toISOString(),
      lastError: error.message,
    });
    console.log(`FAIL ${source.id} ${error.message}`);
  }
}

await fs.writeFile(sourcePath, `${JSON.stringify(updated, null, 2)}\n`);
const verifiedCount = updated.filter((source) => source.verified).length;
console.log(`Verified ${verifiedCount}/${updated.length} candidate sources`);
