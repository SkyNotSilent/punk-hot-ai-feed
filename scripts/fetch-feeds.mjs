import fs from "node:fs/promises";
import { dedupeStories, fetchText, normalizeFeedItem, parseFeed } from "./feed-utils.mjs";

const sourcePath = new URL("../public/data/sources.json", import.meta.url);
const outputPath = new URL("../public/data/live-feed.json", import.meta.url);
const sources = JSON.parse(await fs.readFile(sourcePath, "utf8"));
const sourceMap = new Map(sources.map((source) => [source.id, source]));

const verifiedSources = sources
  .filter((source) => source.enabled && source.url && source.verified && ["rss", "rsshub", "official_blog", "paper", "media"].includes(source.type))
  .slice(0, Number(process.env.PUNK_HOT_SOURCE_LIMIT || 8));

const stories = [];
for (const source of verifiedSources) {
  try {
    const { response, text } = await fetchText(source.url);
    if (!response.ok) {
      console.log(`SKIP ${source.id} ${response.status}`);
      continue;
    }
    const items = parseFeed(text).slice(0, Number(process.env.PUNK_HOT_ITEMS_PER_SOURCE || 5));
    stories.push(...items.map((item) => normalizeFeedItem(item, source, sourceMap)));
    console.log(`FETCH ${source.id} items=${items.length}`);
  } catch (error) {
    console.log(`FAIL ${source.id} ${error.message}`);
  }
}

const output = dedupeStories(stories)
  .sort((a, b) => b.score - a.score || new Date(b.publishedAt) - new Date(a.publishedAt))
  .slice(0, 60);

await fs.writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`);
console.log(`Wrote ${output.length} normalized stories to public/data/live-feed.json`);
