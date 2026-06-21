# Punk Hot AI 热点流

Punk Hot 是一个独立品牌的 AI 热点聚合站原型，保留报纸/编辑部视觉风格，并加入热度评分、收藏、信息溯源、日报/周报/月报、RSS 信息源架构和 Playwright 验证。

## 本地运行

```bash
npm install
npm run dev
```

打开 `http://127.0.0.1:4173/`。

生产构建：

```bash
npm run build
npm run preview
```

## 数据流

核心数据文件：

- `public/data/sources.json`：信源配置，包含 `id`、`name`、`type`、`url`、`weight`、`language`、`category`、`enabled`、`fetchStrategy`、`notes`、验证状态。
- `public/data/seed-stories.json`：人工维护的 mock/样例热点，至少 10 条，每条包含来源链路和原文入口。
- `public/data/live-feed.json`：脚本从已验证公开源抓取并归一化后的真实条目。

数据管线：

```text
sources.json -> verify:sources -> fetch:sources -> normalize -> dedupe -> score -> render
```

验证公开源：

```bash
npm run verify:sources
```

抓取真实公开条目：

```bash
npm run fetch:sources
```

当前配置包含 20+ 个候选源，最近一次验证结果会写回 `sources.json`。当前至少 10 个源可访问并可解析条目，`live-feed.json` 已由多个公开源生成。

## 热度评分机制

评分函数在 `src/scoring.js`，每条内容会得到 `score` 和 `scoreBreakdown`。评分维度：

- 信源数量
- 来源权重
- 发布时间新鲜度
- 是否来自一手来源
- 是否被多个独立来源交叉验证
- 主题重要性
- 用户收藏或点击反馈预留字段

详情抽屉会展示总分、拆解项和信息链路，用户可以看到每条信息从哪些公开源聚合而来。

## 添加信息源

在 `public/data/sources.json` 增加一条配置：

```json
{
  "id": "new-ai-source",
  "name": "New AI Source",
  "type": "rss",
  "url": "https://example.com/feed.xml",
  "weight": 0.7,
  "language": "en",
  "category": "新闻媒体",
  "enabled": true,
  "fetchStrategy": "rss",
  "notes": "公开 RSS 源说明。",
  "verified": false
}
```

然后运行：

```bash
npm run verify:sources
npm run fetch:sources
```

合法性约束：只添加公开 RSS、RSSHub、官方博客、论文源、新闻媒体、GitHub releases 等可公开访问源；不要绕登录，不抓隐私内容。

## 测试与评分

Playwright 覆盖：

- 首页能打开
- 信息流非空
- 搜索可用
- 分类筛选可用
- 收藏可用且刷新后保留
- 详情抽屉可打开
- 溯源信息可见
- 日报/周报/月报可切换
- 移动端无横向溢出
- 桌面端关键模块可见

运行：

```bash
npm test
npm run score
```

当前完成度评分：`93/100`。

## Railway 部署

仓库包含 `railway.json`。Railway 使用：

- Build command: `npm run build`
- Start command: `npm run start`

本地 CLI 登录后可执行：

```bash
railway init
railway up
```

部署后用线上 URL 打开首页，并运行必要的 smoke check。
