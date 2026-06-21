import { expect, test } from "@playwright/test";

test("homepage renders scored AI feed", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "AI 行业动态聚合" })).toBeVisible();
  await expect(page.getByText("今日热点 TOP 1")).toBeVisible();
  await expect(page.getByText("实时热点榜")).toBeVisible();
  await expect(page.locator("[data-testid='story-card']").first()).toBeVisible();
  await expect(page.getByText(/热度 \d+/).first()).toBeVisible();

  const stateShape = await page.evaluate(() => ({
    storyCount: window.PUNK_HOT_STATE.stories.length,
    scoredCount: window.PUNK_HOT_STATE.stories.filter((story) => story.score && story.scoreBreakdown && story.sources && story.originalLinks).length,
    sourceCount: window.PUNK_HOT_STATE.sources.length,
  }));
  expect(stateShape.storyCount).toBeGreaterThanOrEqual(10);
  expect(stateShape.scoredCount).toBeGreaterThanOrEqual(10);
  expect(stateShape.sourceCount).toBeGreaterThanOrEqual(20);
});

test("search, category filter, details and provenance work", async ({ page }) => {
  await page.goto("/");
  await page.getByPlaceholder("搜索标题、信源、标签").fill("Agent");
  await expect(page.getByText(/条结果/)).toBeVisible();
  await page.getByPlaceholder("搜索标题、信源、标签").fill("");
  await page.locator(".chip[data-category='产品发布']").click();
  await expect(page.locator("#resultMeta")).toContainText("产品发布");
  await page.locator("[data-open]").first().click();
  await expect(page.getByText("评分拆解")).toBeVisible();
  await expect(page.getByText("信息链路")).toBeVisible();
  await expect(page.getByText("原文入口")).toBeVisible();
});

test("favorite persists after reload and favorites view filters", async ({ page }) => {
  await page.goto("/");
  const firstSave = page.locator("[data-save]").first();
  await firstSave.click();
  await expect(firstSave).toContainText("已收藏");
  await page.reload();
  await page.locator("[data-view='收藏夹']:visible").first().click();
  await expect(page.locator("[data-testid='story-card']").first()).toBeVisible();
  await expect(page.locator("[data-save]").first()).toContainText("已收藏");
});

test("daily weekly monthly reports and source registry are distinct views", async ({ page }) => {
  await page.goto("/");
  await page.locator("[data-view='日报']:visible").first().click();
  await expect(page.getByRole("heading", { name: "AI 日报" })).toBeVisible();
  await expect(page.getByText("关键趋势")).toBeVisible();
  await page.locator("[data-view='周报']:visible").first().click();
  await expect(page.getByRole("heading", { name: "AI 周报" })).toBeVisible();
  await page.locator("[data-view='月报']:visible").first().click();
  await expect(page.getByRole("heading", { name: "AI 月报" })).toBeVisible();
  await page.locator("[data-view='信源']:visible").first().click();
  await expect(page.getByRole("heading", { name: "信源管理" })).toBeVisible();
  await expect(page.locator(".source-stats").getByText("候选源")).toBeVisible();
});

test("mobile viewport has no horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "AI 行业动态聚合" })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
