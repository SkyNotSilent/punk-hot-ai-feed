import { XMLParser } from "fast-xml-parser";
import { categoryFromText, scoreStory } from "../src/scoring.js";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  trimValues: true,
});

export async function fetchText(url, timeoutMs = 12000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "user-agent": "PunkHotSourceVerifier/0.1 (+https://github.com/SkyNotSilent)",
        accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
      },
    });
    const text = await response.text();
    return { response, text };
  } finally {
    clearTimeout(timeout);
  }
}

export function parseFeed(xml) {
  const parsed = parser.parse(xml);
  const rssItems = parsed?.rss?.channel?.item;
  const atomEntries = parsed?.feed?.entry;
  const items = Array.isArray(rssItems) ? rssItems : rssItems ? [rssItems] : Array.isArray(atomEntries) ? atomEntries : atomEntries ? [atomEntries] : [];
  return items.map((item) => ({
    title: textValue(item.title),
    link: linkValue(item.link || item.guid),
    summary: stripHtml(textValue(item.description || item.summary || item.content || item["content:encoded"])).slice(0, 260),
    publishedAt: dateValue(item.pubDate || item.published || item.updated || item["dc:date"]),
  }));
}

export function normalizeFeedItem(item, source, sourceMap) {
  const title = item.title || "Untitled AI item";
  const summary = item.summary || `${source.name} 发布了一条新的 AI 相关动态。`;
  const publishedAt = item.publishedAt || new Date().toISOString();
  const story = {
    id: `${source.id}-${slugify(title).slice(0, 80)}`,
    publishedAt,
    source: source.name,
    category: categoryFromText(`${title} ${summary} ${source.category}`),
    theme: source.category,
    importance: inferImportance(source),
    title,
    summary,
    reason: "该条目来自已配置公开信息源，进入聚合流后会按信源权重、新鲜度和来源链路重新评分。",
    tags: compactTags([source.category, source.type, source.language]),
    image: "",
    userSignals: { saves: 0, clicks: 0 },
    sources: [
      {
        sourceId: source.id,
        name: source.name,
        type: source.type,
        publishedAt,
        isPrimary: ["official_blog", "paper"].includes(source.type),
        independent: true,
        originalUrl: item.link || source.url,
      },
    ],
    originalLinks: item.link ? [{ label: source.name, url: item.link }] : [{ label: source.name, url: source.url }],
  };
  return scoreStory(story, sourceMap);
}

export function dedupeStories(stories) {
  const seen = new Set();
  return stories.filter((story) => {
    const key = slugify(`${story.title}-${story.originalLinks?.[0]?.url || ""}`);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function textValue(value) {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (typeof value === "object") return String(value["#text"] || value.text || value.href || "");
  return "";
}

function linkValue(value) {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    const alternate = value.find((item) => item.rel === "alternate") || value[0];
    return linkValue(alternate);
  }
  if (value && typeof value === "object") return value.href || value["#text"] || "";
  return "";
}

function dateValue(value) {
  const text = textValue(value);
  const date = text ? new Date(text) : new Date();
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function stripHtml(value) {
  return String(value)
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function compactTags(tags) {
  return tags.filter(Boolean).map((tag) => String(tag).replace(/_/g, " "));
}

function inferImportance(source) {
  if (source.type === "official_blog") return 0.82;
  if (source.type === "paper") return 0.76;
  if (source.type === "rsshub") return 0.58;
  return Math.max(0.5, Math.min(0.78, Number(source.weight || 0.65)));
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/https?:\/\//g, "")
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
