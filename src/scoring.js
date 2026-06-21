const DAY_MS = 24 * 60 * 60 * 1000;

export function scoreStory(story, sourceMap = new Map(), now = new Date()) {
  const sources = Array.isArray(story.sources) ? story.sources : [];
  const uniqueSourceIds = new Set(sources.map((source) => source.sourceId || source.name).filter(Boolean));
  const sourceWeights = sources.map((source) => {
    const configured = sourceMap.get(source.sourceId);
    return Number(source.weight ?? configured?.weight ?? 0.5);
  });
  const averageWeight =
    sourceWeights.length > 0 ? sourceWeights.reduce((total, weight) => total + weight, 0) / sourceWeights.length : 0.35;
  const publishedAt = story.publishedAt ? new Date(story.publishedAt) : now;
  const ageMs = Math.max(0, now.getTime() - publishedAt.getTime());
  const ageDays = ageMs / DAY_MS;
  const independentCount = new Set(
    sources.filter((source) => source.independent !== false).map((source) => source.sourceId || source.name),
  ).size;
  const hasPrimary = sources.some((source) => source.isPrimary || ["official_blog", "paper"].includes(source.type));
  const userSignals = story.userSignals || {};

  const breakdown = {
    sourceCount: clamp(uniqueSourceIds.size * 5, 0, 18),
    sourceWeight: clamp(averageWeight * 20, 0, 20),
    freshness: freshnessScore(ageDays),
    primarySource: hasPrimary ? 14 : 5,
    crossVerification: independentCount >= 3 ? 15 : independentCount >= 2 ? 10 : independentCount === 1 ? 5 : 0,
    importance: clamp(Number(story.importance ?? 0.55) * 15, 0, 15),
    userFeedback: clamp(Number(userSignals.saves || 0) * 0.35 + Number(userSignals.clicks || 0) * 0.06, 0, 8),
  };

  const score = Math.round(
    breakdown.sourceCount +
      breakdown.sourceWeight +
      breakdown.freshness +
      breakdown.primarySource +
      breakdown.crossVerification +
      breakdown.importance +
      breakdown.userFeedback,
  );

  return {
    ...story,
    score: clamp(score, 0, 100),
    scoreBreakdown: Object.fromEntries(
      Object.entries(breakdown).map(([key, value]) => [key, Number(value.toFixed(1))]),
    ),
  };
}

export function explainScore(story) {
  const breakdown = story.scoreBreakdown || {};
  return [
    `信源 ${breakdown.sourceCount ?? 0}`,
    `权重 ${breakdown.sourceWeight ?? 0}`,
    `新鲜度 ${breakdown.freshness ?? 0}`,
    `一手 ${breakdown.primarySource ?? 0}`,
    `交叉验证 ${breakdown.crossVerification ?? 0}`,
    `重要性 ${breakdown.importance ?? 0}`,
    `用户反馈 ${breakdown.userFeedback ?? 0}`,
  ].join(" / ");
}

export function categoryFromText(text = "") {
  const value = text.toLowerCase();
  if (/(paper|arxiv|research|论文|benchmark|eval|研究)/i.test(value)) return "论文研究";
  if (/(launch|release|model|gpt|claude|gemini|llm|模型|发布)/i.test(value)) return "模型发布";
  if (/(product|agent|tool|platform|应用|产品|工具)/i.test(value)) return "产品发布";
  if (/(guide|how|prompt|教程|技巧|方法)/i.test(value)) return "技巧观点";
  return "行业动态";
}

function freshnessScore(ageDays) {
  if (ageDays <= 0.5) return 18;
  if (ageDays <= 1) return 16;
  if (ageDays <= 3) return 12;
  if (ageDays <= 7) return 8;
  if (ageDays <= 30) return 4;
  return 1;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
