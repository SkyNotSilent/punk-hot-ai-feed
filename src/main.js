import "./styles.css";
import { categoryFromText, explainScore, scoreStory } from "./scoring.js";

const STORAGE_KEY = "punk-hot-saved-v1";
const DATE_FORMATTER = new Intl.DateTimeFormat("zh-CN", {
  month: "numeric",
  day: "numeric",
  weekday: "short",
});
const TIME_FORMATTER = new Intl.DateTimeFormat("zh-CN", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});
const DATA_BASE = `${import.meta.env.BASE_URL || "/"}data/`.replace(/\/{2,}/g, "/");
const API_BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/$/, "");

const state = {
  view: "精选",
  category: "全部",
  query: "",
  saved: new Set(loadSaved()),
  stories: [],
  sources: [],
  selectedSourceGroup: "全部",
};

const app = document.querySelector("#app");

app.innerHTML = `
  <div class="shell">
    <aside class="sidebar" aria-label="主导航">
      <a class="brand" href="#" aria-label="Punk Hot 首页" data-view="精选">
        <span class="brand-mark">PH</span>
        <span>
          <strong>Punk Hot</strong>
          <small>AI 热点流</small>
        </span>
      </a>

      <nav class="nav-block" aria-label="内容">
        <p>内容</p>
        <button class="nav-link is-active" data-view="精选">精选</button>
        <button class="nav-link" data-view="全部">全部动态</button>
        <button class="nav-link" data-view="收藏夹">收藏夹</button>
        <button class="nav-link" data-view="日报">AI 日报</button>
        <button class="nav-link" data-view="周报">AI 周报</button>
        <button class="nav-link" data-view="月报">AI 月报</button>
        <button class="nav-link" data-view="信源">信源管理</button>
      </nav>

      <nav class="nav-block" aria-label="分类">
        <p>分类</p>
        <button class="nav-link" data-category="全部">全部分类</button>
        <button class="nav-link" data-category="模型发布">模型发布</button>
        <button class="nav-link" data-category="产品发布">产品发布</button>
        <button class="nav-link" data-category="行业动态">行业动态</button>
        <button class="nav-link" data-category="论文研究">论文研究</button>
        <button class="nav-link" data-category="技巧观点">技巧观点</button>
      </nav>

      <div class="source-box">
        <span>信源覆盖</span>
        <strong id="sourceCount">--</strong>
        <small id="verifiedCount">RSS / RSSHub / Blog / Paper / News</small>
      </div>
    </aside>

    <main class="main">
      <header class="topbar">
        <div>
          <p class="eyebrow" id="todayLabel">今日编辑部</p>
          <h1>AI 行业动态聚合</h1>
        </div>
        <div class="topbar-actions">
          <label class="search">
            <span>搜索</span>
            <input id="searchInput" type="search" placeholder="搜索标题、信源、标签" />
          </label>
          <button class="ghost-button" id="resetButton">重置</button>
        </div>
      </header>

      <section class="mobile-tabs" aria-label="移动导航">
        <button class="tab is-active" data-view="精选">精选</button>
        <button class="tab" data-view="全部">全部</button>
        <button class="tab" data-view="收藏夹">收藏</button>
        <button class="tab" data-view="日报">日报</button>
        <button class="tab" data-view="周报">周报</button>
        <button class="tab" data-view="月报">月报</button>
        <button class="tab" data-view="信源">信源</button>
      </section>

      <section class="hero-grid" aria-label="今日概览">
        <article class="top-story" id="topStory"></article>

        <aside class="trend-panel" aria-label="实时热点榜">
          <div class="section-head">
            <span>实时热点榜</span>
            <small>多信源热度 · 随时间衰减</small>
          </div>
          <ol class="trend-list" id="trendList"></ol>
        </aside>
      </section>

      <section class="filters" aria-label="分类筛选">
        <button class="chip is-active" data-category="全部">全部</button>
        <button class="chip" data-category="模型发布">模型</button>
        <button class="chip" data-category="产品发布">产品</button>
        <button class="chip" data-category="行业动态">行业</button>
        <button class="chip" data-category="论文研究">论文</button>
        <button class="chip" data-category="技巧观点">技巧</button>
      </section>

      <section id="reportView" class="report-view" hidden></section>
      <section id="sourceView" class="source-view" hidden></section>

      <section class="content-layout" id="feedShell">
        <section class="feed" aria-label="最新动态">
          <div class="section-head feed-head">
            <span id="feedTitle">最新精选</span>
            <small id="resultMeta">AI 自动挑选的高价值内容</small>
          </div>
          <div id="feedList"></div>
        </section>

        <aside class="brief-panel" aria-label="评分与日报">
          <div class="section-head">
            <span>热度评分</span>
            <small>7 因子合成</small>
          </div>
          <div class="score-card">
            <div class="score-formula">
              <strong>Score</strong>
              <span>信源数 + 来源权重 + 新鲜度 + 一手来源 + 交叉验证 + 主题重要性 + 用户反馈</span>
            </div>
            <button class="solid-button" data-view="日报">查看今日日报</button>
          </div>

          <div class="section-head brief-title">
            <span>AI 日报</span>
            <small>自动聚合摘要</small>
          </div>
          <div class="daily-card">
            <img
              src="https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&w=900&q=80"
              alt="AI 数据可视化"
            />
            <h2 id="dailyTitle">今日热点正在聚合</h2>
            <p id="dailySummary">从模型、产品、资本、开源、论文与应用趋势里提取高价值信号。</p>
            <button class="solid-button" id="digestButton">生成日报</button>
          </div>
        </aside>
      </section>
    </main>
  </div>

  <div class="drawer" id="drawer" aria-hidden="true">
    <button class="drawer-backdrop" id="drawerBackdrop" aria-label="关闭详情"></button>
    <article class="drawer-card" role="dialog" aria-modal="true" aria-labelledby="drawerTitle">
      <button class="close-button" id="closeDrawer" aria-label="关闭">×</button>
      <div id="drawerContent"></div>
    </article>
  </div>
`;

const refs = {
  sourceCount: document.querySelector("#sourceCount"),
  verifiedCount: document.querySelector("#verifiedCount"),
  todayLabel: document.querySelector("#todayLabel"),
  topStory: document.querySelector("#topStory"),
  trendList: document.querySelector("#trendList"),
  feedList: document.querySelector("#feedList"),
  feedTitle: document.querySelector("#feedTitle"),
  resultMeta: document.querySelector("#resultMeta"),
  searchInput: document.querySelector("#searchInput"),
  drawer: document.querySelector("#drawer"),
  drawerContent: document.querySelector("#drawerContent"),
  reportView: document.querySelector("#reportView"),
  sourceView: document.querySelector("#sourceView"),
  feedShell: document.querySelector("#feedShell"),
  dailyTitle: document.querySelector("#dailyTitle"),
  dailySummary: document.querySelector("#dailySummary"),
};

bootstrap();

async function bootstrap() {
  refs.todayLabel.textContent = `${DATE_FORMATTER.format(new Date())} · 编辑部雷达`;
  const apiSnapshot = await loadApiSnapshot();
  const [sources, seedStories, liveStories] = apiSnapshot
    ? [apiSnapshot.sources, apiSnapshot.stories, []]
    : await Promise.all([
        loadJson(`${DATA_BASE}sources.json`, []),
        loadJson(`${DATA_BASE}seed-stories.json`, []),
        loadJson(`${DATA_BASE}live-feed.json`, []),
      ]);
  state.sources = sources;
  const sourceMap = new Map(sources.map((source) => [source.id, source]));
  state.stories = dedupeStories([...liveStories, ...seedStories])
    .map((story) => normalizeStory(story, sourceMap))
    .sort((a, b) => b.score - a.score || new Date(b.publishedAt) - new Date(a.publishedAt));

  window.PUNK_HOT_STATE = {
    stories: state.stories,
    sources: state.sources,
    scoreStory,
  };

  renderAll();
}

async function loadJson(path, fallback) {
  try {
    const response = await fetch(path, { cache: "no-store" });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return await response.json();
  } catch (error) {
    console.warn(`Failed to load ${path}`, error);
    return fallback;
  }
}

async function loadApiSnapshot() {
  if (!shouldUseApi()) return null;
  try {
    const [sourceResponse, storyResponse] = await Promise.all([
      fetch(`${API_BASE}/api/sources`, { cache: "no-store" }),
      fetch(`${API_BASE}/api/stories?limit=160`, { cache: "no-store" }),
    ]);
    if (!sourceResponse.ok || !storyResponse.ok) return null;
    const [sourcePayload, storyPayload] = await Promise.all([sourceResponse.json(), storyResponse.json()]);
    if (!sourcePayload.ok || !storyPayload.ok) return null;
    return {
      sources: sourcePayload.sources || [],
      stories: storyPayload.stories || [],
    };
  } catch {
    return null;
  }
}

function shouldUseApi() {
  if (API_BASE) return true;
  if (import.meta.env.DEV) return false;
  return !window.location.hostname.endsWith("github.io");
}

function dedupeStories(stories) {
  const seen = new Set();
  return stories.filter((story) => {
    const fingerprint = slugify(`${story.title}-${story.originalLinks?.[0]?.url || ""}`);
    if (seen.has(fingerprint)) return false;
    seen.add(fingerprint);
    return true;
  });
}

function normalizeStory(story, sourceMap) {
  const scored = scoreStory(
    {
      category: story.category || categoryFromText(`${story.title} ${story.summary}`),
      tags: story.tags || [],
      sources: story.sources || [],
      originalLinks: story.originalLinks || [],
      userSignals: story.userSignals || { saves: 0, clicks: 0 },
      ...story,
    },
    sourceMap,
  );
  return {
    ...scored,
    source: scored.source || scored.sources?.[0]?.name || "公开源",
    theme: scored.theme || scored.category,
    publishedAt: scored.publishedAt || new Date().toISOString(),
    image:
      scored.image ||
      "https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&w=900&q=80",
  };
}

function visibleStories() {
  const query = state.query.trim().toLowerCase();
  return state.stories.filter((story) => {
    const viewMatch =
      state.view === "全部" ||
      state.view === "精选" ||
      (state.view === "收藏夹" ? state.saved.has(story.id) : true);
    const categoryMatch = state.category === "全部" || story.category === state.category;
    const queryMatch =
      !query ||
      [story.title, story.summary, story.source, story.category, story.theme, ...story.tags]
        .join(" ")
        .toLowerCase()
        .includes(query);
    return viewMatch && categoryMatch && queryMatch;
  });
}

function renderAll() {
  refs.sourceCount.textContent = state.sources.length;
  const verified = state.sources.filter((source) => source.verified).length;
  refs.verifiedCount.textContent = `${verified} 已验证 · RSS/RSSHub/Blog/Paper/News`;
  renderTopStory();
  renderTrends();
  renderDailySideCard();
  renderMode();
  syncActive();
}

function renderMode() {
  const isReport = ["日报", "周报", "月报"].includes(state.view);
  const isSource = state.view === "信源";
  refs.reportView.hidden = !isReport;
  refs.sourceView.hidden = !isSource;
  refs.feedShell.hidden = isReport || isSource;
  if (isReport) renderReport(state.view);
  if (isSource) renderSourceView();
  if (!isReport && !isSource) renderFeed();
}

function renderTopStory() {
  const story = state.stories[0];
  if (!story) return;
  refs.topStory.innerHTML = `
    <div class="top-story-content">
      <span class="rank-label">今日热点 TOP 1</span>
      <h2>${escapeHtml(story.title)}</h2>
      <p>${escapeHtml(story.reason || story.summary)}</p>
      <div class="meta-row">
        <span class="meta-pill score-pill">热度 ${story.score}</span>
        <span class="meta-pill">${story.sources.length} 信源</span>
        <span class="meta-pill">${formatDateTime(story.publishedAt)}</span>
        <span class="meta-pill">${story.category}</span>
      </div>
    </div>
    <img src="${story.image}" alt="${escapeAttribute(story.title)}" />
  `;
  refs.topStory.dataset.open = story.id;
}

function renderTrends() {
  refs.trendList.innerHTML = state.stories
    .slice(0, 7)
    .map(
      (story) => `
        <li data-open="${story.id}">
          <div>
            <p class="trend-title">${escapeHtml(story.title)}</p>
            <span class="trend-source">${escapeHtml(story.source)} · ${story.sources.length} 信源</span>
          </div>
          <strong class="trend-heat">${story.score}</strong>
        </li>
      `,
    )
    .join("");
}

function renderDailySideCard() {
  const top = state.stories[0];
  const categories = summarizeByCategory(state.stories.slice(0, 8));
  refs.dailyTitle.textContent = top ? `${top.theme} 领跑今日 AI 热点` : "今日热点正在聚合";
  refs.dailySummary.textContent = `当前主要信号集中在 ${categories.slice(0, 3).join("、")}。热度分数同时考虑来源可信度、发布时间和交叉验证。`;
}

function renderFeed() {
  const items = visibleStories();
  refs.feedTitle.textContent = state.view === "收藏夹" ? "收藏夹" : state.view === "全部" ? "全部动态" : "最新精选";
  refs.resultMeta.textContent = `${items.length} 条结果 · ${state.category} · ${state.view}`;

  if (!items.length) {
    refs.feedList.innerHTML = `<div class="empty-state">没有匹配内容。换个关键词、切换分类或重置筛选。</div>`;
    return;
  }

  const grouped = items.reduce((groups, story) => {
    const label = DATE_FORMATTER.format(new Date(story.publishedAt));
    groups[label] ||= [];
    groups[label].push(story);
    return groups;
  }, {});

  refs.feedList.innerHTML = Object.entries(grouped)
    .map(
      ([date, stories]) => `
        <div class="date-group">
          <h2 class="date-heading">${date}</h2>
          ${stories.map(renderStoryCard).join("")}
        </div>
      `,
    )
    .join("");
}

function renderStoryCard(story) {
  const saved = state.saved.has(story.id);
  return `
    <article class="story-card" data-testid="story-card">
      <time class="story-time">${formatTime(story.publishedAt)}</time>
      <div class="story-main">
        <div class="story-source">
          <span class="source-dot" aria-hidden="true"></span>
          <span>${escapeHtml(story.source)}</span>
          <span class="meta-pill score-pill">热度 ${story.score}</span>
          <span>${story.sources.length} 信源</span>
          <span>${escapeHtml(story.category)}</span>
        </div>
        <h3><button data-open="${story.id}">${escapeHtml(story.title)}</button></h3>
        <p>${escapeHtml(story.summary)}</p>
        <div class="tag-row">
          ${story.tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}
        </div>
        <div class="story-actions">
          <button class="mini-button" data-open="${story.id}">详情</button>
          <button class="mini-button ${saved ? "is-saved" : ""}" data-save="${story.id}">
            ${saved ? "已收藏" : "收藏"}
          </button>
          ${story.originalLinks?.[0] ? `<a class="mini-link" href="${story.originalLinks[0].url}" target="_blank" rel="noreferrer">原文</a>` : ""}
        </div>
      </div>
    </article>
  `;
}

function renderReport(type) {
  const items = reportStories(type);
  const themes = summarizeByTheme(items);
  const categories = summarizeByCategory(items);
  const headline = items[0];
  const reportTitle = {
    日报: "AI 日报",
    周报: "AI 周报",
    月报: "AI 月报",
  }[type];
  const reportDescription = {
    日报: "按当天高热内容自动聚合，强调今天最值得看的信号。",
    周报: "按 7 天趋势归并主题，适合复盘模型、产品和工程动态。",
    月报: "按月观察模型、产品、资本、开源、论文和应用趋势。",
  }[type];

  refs.reportView.innerHTML = `
    <div class="report-paper">
      <div class="report-kicker">${reportDescription}</div>
      <h2>${reportTitle}</h2>
      <p class="report-summary">
        ${headline ? `本期最高热度是「${escapeHtml(headline.title)}」，总分 ${headline.score}。` : "暂无可生成报告的内容。"}
        当前核心趋势集中在 ${themes.slice(0, 4).join("、")}。
      </p>
      <div class="report-grid">
        <section>
          <h3>关键趋势</h3>
          <ul class="report-list">
            ${themes.slice(0, 6).map((theme) => `<li>${theme}</li>`).join("")}
          </ul>
        </section>
        <section>
          <h3>分类温度</h3>
          <ul class="report-list">
            ${categories.map((category) => `<li>${category}</li>`).join("")}
          </ul>
        </section>
        <section>
          <h3>TOP 内容</h3>
          <ol class="report-list ranked">
            ${items
              .slice(0, 6)
              .map((story) => `<li><button data-open="${story.id}">${escapeHtml(story.title)}</button><strong>${story.score}</strong></li>`)
              .join("")}
          </ol>
        </section>
      </div>
    </div>
  `;
}

function renderSourceView() {
  const groups = groupBy(state.sources, "category");
  refs.sourceView.innerHTML = `
    <div class="source-dashboard">
      <div class="source-dashboard-head">
        <div>
          <p class="report-kicker">Sources Registry</p>
          <h2>信源管理</h2>
        </div>
        <div class="source-stats">
          <strong>${state.sources.length}</strong><span>候选源</span>
          <strong>${state.sources.filter((source) => source.verified).length}</strong><span>已验证</span>
        </div>
      </div>
      <div class="source-groups">
        ${Object.entries(groups)
          .map(
            ([category, sources]) => `
              <section class="source-group">
                <h3>${escapeHtml(category)}</h3>
                <div class="source-list">
                  ${sources
                    .map(
                      (source) => `
                        <article class="source-card">
                          <div>
                            <strong>${escapeHtml(source.name)}</strong>
                            <p>${escapeHtml(source.notes || "")}</p>
                          </div>
                          <div class="source-meta">
                            <span>${escapeHtml(source.type)}</span>
                            <span>权重 ${source.weight}</span>
                            <span class="${source.verified ? "ok" : "pending"}">${source.verified ? "已验证" : "待验证"}</span>
                          </div>
                          ${source.url ? `<a href="${source.url}" target="_blank" rel="noreferrer">打开源</a>` : ""}
                        </article>
                      `,
                    )
                    .join("")}
                </div>
              </section>
            `,
          )
          .join("")}
      </div>
    </div>
  `;
}

function reportStories(type) {
  const now = Date.now();
  const spanDays = type === "日报" ? 1 : type === "周报" ? 7 : 31;
  const filtered = state.stories.filter((story) => now - new Date(story.publishedAt).getTime() <= spanDays * 24 * 60 * 60 * 1000);
  return (filtered.length ? filtered : state.stories).slice(0, type === "日报" ? 8 : type === "周报" ? 12 : 16);
}

function openDrawer(id) {
  const story = state.stories.find((item) => item.id === id);
  if (!story) return;

  refs.drawerContent.innerHTML = `
    <div class="meta-row">
      <span class="meta-pill score-pill">热度 ${story.score}</span>
      <span class="meta-pill">${escapeHtml(story.category)}</span>
      <span class="meta-pill">${formatDateTime(story.publishedAt)}</span>
    </div>
    <h2 id="drawerTitle">${escapeHtml(story.title)}</h2>
    <img class="drawer-image" src="${story.image}" alt="${escapeAttribute(story.title)}" />
    <p>${escapeHtml(story.summary)}</p>
    <p><strong>推荐理由：</strong>${escapeHtml(story.reason || "该内容在多个公开源中出现，具备持续跟踪价值。")}</p>

    <section class="drawer-section">
      <h3>评分拆解</h3>
      <p class="score-explain">${explainScore(story)}</p>
      <div class="score-breakdown">
        ${Object.entries(story.scoreBreakdown)
          .map(([key, value]) => `<div><span>${scoreLabel(key)}</span><strong>${value}</strong></div>`)
          .join("")}
      </div>
    </section>

    <section class="drawer-section">
      <h3>信息链路</h3>
      <div class="timeline">
        ${story.sources
          .map(
            (source, index) => `
              <div class="timeline-item">
                <span>${index + 1}</span>
                <div>
                  <strong>${escapeHtml(source.name)}</strong>
                  <p>${escapeHtml(source.type)} · ${source.isPrimary ? "一手来源" : "二次来源"} · ${formatDateTime(source.publishedAt || story.publishedAt)}</p>
                  ${source.originalUrl ? `<a href="${source.originalUrl}" target="_blank" rel="noreferrer">原文链接</a>` : "<em>手动或预留源</em>"}
                </div>
              </div>
            `,
          )
          .join("")}
      </div>
    </section>

    <section class="drawer-section">
      <h3>原文入口</h3>
      <div class="original-links">
        ${(story.originalLinks || [])
          .map((link) => `<a href="${link.url}" target="_blank" rel="noreferrer">${escapeHtml(link.label || "原文")}</a>`)
          .join("")}
      </div>
    </section>
  `;

  refs.drawer.classList.add("is-open");
  refs.drawer.setAttribute("aria-hidden", "false");
}

function closeDrawer() {
  refs.drawer.classList.remove("is-open");
  refs.drawer.setAttribute("aria-hidden", "true");
}

function setView(view) {
  state.view = view;
  if (["日报", "周报", "月报", "信源"].includes(view)) state.category = "全部";
  renderMode();
  syncActive();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function syncActive() {
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.view === state.view);
  });
  document.querySelectorAll("[data-category]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.category === state.category);
  });
}

document.addEventListener("click", (event) => {
  const viewButton = event.target.closest("[data-view]");
  if (viewButton) {
    event.preventDefault();
    setView(viewButton.dataset.view);
    return;
  }

  const categoryButton = event.target.closest("[data-category]");
  if (categoryButton) {
    state.category = categoryButton.dataset.category;
    renderMode();
    syncActive();
    return;
  }

  const openButton = event.target.closest("[data-open]");
  if (openButton) {
    openDrawer(openButton.dataset.open);
    return;
  }

  const saveButton = event.target.closest("[data-save]");
  if (saveButton) {
    const id = saveButton.dataset.save;
    state.saved.has(id) ? state.saved.delete(id) : state.saved.add(id);
    persistSaved();
    renderMode();
  }
});

refs.searchInput.addEventListener("input", (event) => {
  state.query = event.target.value;
  renderMode();
});

document.querySelector("#resetButton").addEventListener("click", () => {
  state.view = "精选";
  state.category = "全部";
  state.query = "";
  refs.searchInput.value = "";
  renderMode();
  syncActive();
});

document.querySelector("#digestButton").addEventListener("click", () => setView("日报"));
document.querySelector("#closeDrawer").addEventListener("click", closeDrawer);
document.querySelector("#drawerBackdrop").addEventListener("click", closeDrawer);
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeDrawer();
});

function summarizeByTheme(stories) {
  return summarize(stories.map((story) => story.theme || story.category));
}

function summarizeByCategory(stories) {
  return summarize(stories.map((story) => story.category));
}

function summarize(items) {
  const counts = items.reduce((acc, item) => {
    acc[item] = (acc[item] || 0) + 1;
    return acc;
  }, {});
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([label, count]) => `${label} ${count}`);
}

function groupBy(items, key) {
  return items.reduce((groups, item) => {
    const value = item[key] || "其他";
    groups[value] ||= [];
    groups[value].push(item);
    return groups;
  }, {});
}

function loadSaved() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function persistSaved() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...state.saved]));
}

function formatTime(value) {
  return TIME_FORMATTER.format(new Date(value));
}

function formatDateTime(value) {
  return `${DATE_FORMATTER.format(new Date(value))} ${formatTime(value)}`;
}

function scoreLabel(key) {
  return {
    sourceCount: "信源数量",
    sourceWeight: "来源权重",
    freshness: "新鲜度",
    primarySource: "一手来源",
    crossVerification: "交叉验证",
    importance: "主题重要性",
    userFeedback: "用户反馈",
  }[key];
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/https?:\/\//g, "")
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value = "") {
  return escapeHtml(value).replaceAll("`", "&#096;");
}
