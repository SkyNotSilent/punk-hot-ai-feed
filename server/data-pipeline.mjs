import fs from "node:fs/promises";
import { dedupeStories, fetchText, normalizeFeedItem, parseFeed } from "../scripts/feed-utils.mjs";
import { scoreStory } from "../src/scoring.js";

const SOURCES_PATH = new URL("../public/data/sources.json", import.meta.url);
const SEED_PATH = new URL("../public/data/seed-stories.json", import.meta.url);
const LIVE_PATH = new URL("../public/data/live-feed.json", import.meta.url);

export async function loadSeedDataset() {
  const [sources, seedStories, liveStories] = await Promise.all([
    readJson(SOURCES_PATH, []),
    readJson(SEED_PATH, []),
    readJson(LIVE_PATH, []),
  ]);
  const sourceMap = new Map(sources.map((source) => [source.id, source]));
  return {
    sources,
    stories: dedupeStories([...liveStories, ...seedStories])
      .map((story) => scoreStory(story, sourceMap))
      .sort((a, b) => b.score - a.score || new Date(b.publishedAt) - new Date(a.publishedAt)),
  };
}

export async function refreshFromSources(sources, options = {}) {
  const sourceLimit = Number(options.sourceLimit || process.env.PUNK_HOT_SOURCE_LIMIT || 8);
  const itemsPerSource = Number(options.itemsPerSource || process.env.PUNK_HOT_ITEMS_PER_SOURCE || 6);
  const sourceMap = new Map(sources.map((source) => [source.id, source]));
  const updatedSources = [];
  const stories = [];

  const candidates = sources
    .filter((source) => source.enabled && source.url && ["rss", "rsshub", "official_blog", "paper", "media"].includes(source.type))
    .sort((a, b) => Number(b.verified) - Number(a.verified) || Number(b.weight || 0) - Number(a.weight || 0))
    .slice(0, sourceLimit);

  for (const source of candidates) {
    try {
      const { response, text } = await fetchText(source.url, Number(process.env.PUNK_HOT_FETCH_TIMEOUT_MS || 12000));
      const items = response.ok ? parseFeed(text) : [];
      const verified = response.ok && items.length > 0;
      const checkedSource = {
        ...source,
        verified,
        status: response.status,
        itemCount: items.length,
        lastCheckedAt: new Date().toISOString(),
        lastError: verified ? "" : `No feed items parsed from ${response.status}`,
      };
      updatedSources.push(checkedSource);
      if (verified) {
        stories.push(...items.slice(0, itemsPerSource).map((item) => normalizeFeedItem(item, checkedSource, sourceMap)));
      }
    } catch (error) {
      updatedSources.push({
        ...source,
        verified: false,
        status: "error",
        itemCount: 0,
        lastCheckedAt: new Date().toISOString(),
        lastError: error.message,
      });
    }
  }

  const untouchedSources = sources.filter((source) => !updatedSources.some((item) => item.id === source.id));
  return {
    sources: [...updatedSources, ...untouchedSources],
    checkedSourceCount: updatedSources.length,
    stories: dedupeStories(stories)
      .sort((a, b) => b.score - a.score || new Date(b.publishedAt) - new Date(a.publishedAt))
      .slice(0, 100),
  };
}

export function buildReport(stories, range = "daily") {
  const spanDays = range === "weekly" ? 7 : range === "monthly" ? 31 : 1;
  const now = Date.now();
  const scoped = stories.filter((story) => now - new Date(story.publishedAt).getTime() <= spanDays * 24 * 60 * 60 * 1000);
  const items = scoped.length ? scoped : stories.slice(0, range === "daily" ? 8 : range === "weekly" ? 16 : 24);
  return {
    range,
    generatedAt: new Date().toISOString(),
    summary: summarize(items),
    trends: countBy(items, "theme").slice(0, 8),
    categories: countBy(items, "category"),
    topStories: items.slice(0, range === "daily" ? 8 : range === "weekly" ? 12 : 16),
  };
}

function summarize(stories) {
  if (!stories.length) return "暂无可生成报告的内容。";
  const top = stories[0];
  const themes = countBy(stories, "theme")
    .slice(0, 3)
    .map((item) => item.label)
    .join("、");
  return `本期最高热度是「${top.title}」，总分 ${top.score}。核心趋势集中在 ${themes || "AI 行业动态"}。`;
}

function countBy(stories, key) {
  const counts = stories.reduce((acc, story) => {
    const label = story[key] || "其他";
    acc[label] = (acc[label] || 0) + 1;
    return acc;
  }, {});
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([label, count]) => ({ label, count }));
}

async function readJson(url, fallback) {
  try {
    return JSON.parse(await fs.readFile(url, "utf8"));
  } catch {
    return fallback;
  }
}
