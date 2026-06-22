import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

export function openCache(dbPath = process.env.DB_PATH || ".data/punk-hot.sqlite") {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec(`
    CREATE TABLE IF NOT EXISTS sources (
      id TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      verified INTEGER NOT NULL DEFAULT 0,
      item_count INTEGER NOT NULL DEFAULT 0,
      status TEXT,
      last_checked_at TEXT
    );
    CREATE TABLE IF NOT EXISTS stories (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      score INTEGER NOT NULL DEFAULT 0,
      published_at TEXT NOT NULL,
      category TEXT NOT NULL,
      source TEXT NOT NULL,
      data TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_stories_score ON stories(score DESC);
    CREATE INDEX IF NOT EXISTS idx_stories_published_at ON stories(published_at DESC);
    CREATE INDEX IF NOT EXISTS idx_stories_category ON stories(category);
  `);

  return {
    path: dbPath,
    upsertSources(sources) {
      const statement = db.prepare(`
        INSERT INTO sources (id, data, verified, item_count, status, last_checked_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          data = excluded.data,
          verified = excluded.verified,
          item_count = excluded.item_count,
          status = excluded.status,
          last_checked_at = excluded.last_checked_at
      `);
      db.exec("BEGIN");
      try {
        for (const source of sources) {
          statement.run(
            source.id,
            JSON.stringify(source),
            source.verified ? 1 : 0,
            Number(source.itemCount || 0),
            String(source.status ?? ""),
            source.lastCheckedAt || "",
          );
        }
        db.exec("COMMIT");
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    },
    upsertStories(stories) {
      const statement = db.prepare(`
        INSERT INTO stories (id, title, score, published_at, category, source, data, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          title = excluded.title,
          score = excluded.score,
          published_at = excluded.published_at,
          category = excluded.category,
          source = excluded.source,
          data = excluded.data,
          updated_at = excluded.updated_at
      `);
      const now = new Date().toISOString();
      db.exec("BEGIN");
      try {
        for (const story of stories) {
          statement.run(
            story.id,
            story.title,
            Number(story.score || 0),
            story.publishedAt || now,
            story.category || "行业动态",
            story.source || story.sources?.[0]?.name || "公开源",
            JSON.stringify(story),
            now,
          );
        }
        db.exec("COMMIT");
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    },
    listSources() {
      return db
        .prepare("SELECT data FROM sources ORDER BY verified DESC, id ASC")
        .all()
        .map((row) => JSON.parse(row.data));
    },
    listStories({ category = "", q = "", limit = 120 } = {}) {
      const rows = db
        .prepare("SELECT data FROM stories ORDER BY score DESC, published_at DESC LIMIT ?")
        .all(Number(limit) || 120)
        .map((row) => JSON.parse(row.data));
      const query = q.trim().toLowerCase();
      return rows.filter((story) => {
        const categoryMatch = !category || category === "全部" || story.category === category;
        const queryMatch =
          !query ||
          [story.title, story.summary, story.source, story.category, story.theme, ...(story.tags || [])]
            .join(" ")
            .toLowerCase()
            .includes(query);
        return categoryMatch && queryMatch;
      });
    },
    stats() {
      const source = db.prepare("SELECT COUNT(*) AS total, SUM(verified) AS verified FROM sources").get();
      const story = db.prepare("SELECT COUNT(*) AS total FROM stories").get();
      const lastRefresh = db.prepare("SELECT value FROM meta WHERE key = 'lastRefreshAt'").get();
      return {
        sourceCount: Number(source.total || 0),
        verifiedSourceCount: Number(source.verified || 0),
        storyCount: Number(story.total || 0),
        lastRefreshAt: lastRefresh?.value || "",
        dbPath,
      };
    },
    getMeta(key) {
      return db.prepare("SELECT value FROM meta WHERE key = ?").get(key)?.value || "";
    },
    setMeta(key, value) {
      db.prepare(`
        INSERT INTO meta (key, value)
        VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `).run(key, value);
    },
    close() {
      db.close();
    },
  };
}
