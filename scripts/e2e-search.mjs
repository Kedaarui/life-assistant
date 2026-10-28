import assert from "node:assert/strict";

/**
 * P2 search + coarse-time E2E.
 *
 * Start the mock LLM/embedding server and the app with an embedding config:
 *   npm run mock:llm
 *   LIFE_DATA_DIR=./.tmp-search-data \
 *     LLM_PROVIDER=custom LLM_API_KEY=mock \
 *     LLM_BASE_URL=http://127.0.0.1:3300/v1 LLM_CHAT_MODEL=mock-model \
 *     EMBEDDING_API_KEY=mock EMBEDDING_BASE_URL=http://127.0.0.1:3300/v1 \
 *     EMBEDDING_MODEL=mock-embedding EMBEDDING_DIM=1024 \
 *     npm run dev -- -p 3100
 *   BASE_URL=http://127.0.0.1:3100 EXPECT_EMBEDDINGS=1 npm run test:search
 */

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3100";
const runId = Date.now().toString(36);
const secret = `LOCAL_ONLY_SEARCH_${runId}`;
const createdIds = [];

async function json(path, options) {
  const response = await fetch(`${BASE}${path}`, options);
  const body = await response.json();
  return { response, body };
}

async function createEntry(entry) {
  const { response, body } = await json("/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(entry),
  });
  assert.equal(response.status, 201);
  createdIds.push(body.event.id);
  return body.event;
}

function log(name, detail = "") {
  console.log(`✓ ${name}${detail ? ` — ${detail}` : ""}`);
}

const yearEntry = await createEntry({
  title: `在上海工作-${runId}`,
  description: `${runId} 那年夏天刚毕业，在上海做产品设计，周末常去图书馆。`,
  eventTime: "2015-06-15T12:00:00+08:00",
  eventPrecision: "year",
  timeNote: "夏天",
  tags: ["工作", "上海"],
});
assert.equal(yearEntry.eventPrecision, "year");
const yearStart = new Date(yearEntry.eventTime);
assert.equal(yearStart.getFullYear(), 2015);
assert.equal(yearStart.getMonth(), 0);
assert.equal(yearStart.getDate(), 1);
assert.equal(yearStart.getHours(), 0);
const yearEnd = new Date(yearEntry.eventTimeEnd);
assert.equal(yearEnd.getFullYear(), 2016);
assert.equal(yearEnd.getMonth(), 0);
assert.equal(yearEnd.getDate(), 1);
assert.equal(yearEntry.timeNote, "夏天");
log("year-only entry", "归一化到 2015-01-01 → 2016-01-01");

const monthEntry = await createEntry({
  title: `大学毕业-${runId}`,
  description: `${runId} 大学毕业，搬到北京，开始第一份工作。`,
  eventTime: "2019-06-15T12:00:00+08:00",
  eventPrecision: "month",
  tags: ["毕业", "北京"],
});
const monthStart = new Date(monthEntry.eventTime);
assert.equal(monthStart.getFullYear(), 2019);
assert.equal(monthStart.getMonth(), 5);
assert.equal(monthStart.getDate(), 1);
const monthEnd = new Date(monthEntry.eventTimeEnd);
assert.equal(monthEnd.getMonth(), 6);
assert.equal(monthEnd.getDate(), 1);
log("month-only entry", "归一化到 2019-06-01 → 2019-07-01");

const dayEntry = await createEntry({
  title: `第一次看海-${runId}`,
  description: `${runId} 第一次看海，在青岛，风很大。`,
  eventTime: "2021-08-14T15:30:00+08:00",
  eventPrecision: "day",
  tags: ["旅行"],
});
const dayStart = new Date(dayEntry.eventTime);
assert.equal(dayStart.getFullYear(), 2021);
assert.equal(dayStart.getMonth(), 7);
assert.equal(dayStart.getDate(), 14);
assert.equal(dayStart.getHours(), 0);
log("day-only entry", "归一化到当天零点");

const photoEntry = await createEntry({
  title: `开始学习摄影-${runId}`,
  description: `${runId} 开始学习摄影，最喜欢拍清晨的街道。`,
  eventTime: "2023-03-05T10:20:00+08:00",
  eventPrecision: "datetime",
  tags: ["摄影", "学习"],
});
assert.equal(photoEntry.eventPrecision, "datetime");
assert.equal(photoEntry.eventTimeEnd, null);
log("exact entry", "保留具体时刻");

const secretEntry = await createEntry({
  title: `秘密项目-${runId}`,
  description: `${secret} 这件事只想自己知道，不想被检索。`,
  eventTime: "2015-09-01T12:00:00+08:00",
  eventPrecision: "year",
  sensitivity: "local_only",
  tags: ["私密"],
});
assert.equal(secretEntry.eventPrecision, "year");
log("local-only entry", "不进入检索索引");

const search = await json(`/api/search?q=${encodeURIComponent("上海工作")}`);
assert.equal(search.response.status, 200);
const searchIds = search.body.results.map((result) => result.entry.id);
assert.ok(searchIds.includes(yearEntry.id), "matches the year-only entry");
assert.ok(
  !searchIds.includes(secretEntry.id),
  "local_only entry is absent from search",
);
log(
  "hybrid search",
  `mode=${search.body.mode}, semantic=${search.body.semanticConfigured}`,
);

if (process.env.EXPECT_EMBEDDINGS === "1") {
  assert.equal(search.body.semanticConfigured, true);
  assert.ok(["hybrid", "vector"].includes(search.body.mode));
}

const photoSearch = await json(
  `/api/search?q=${encodeURIComponent("摄影")}`,
);
assert.ok(
  photoSearch.body.results.some(
    (result) => result.entry.id === photoEntry.id,
  ),
);
log("keyword/semantic search", "摄影命中 2023 年的记录");

const filtered = await json(
  `/api/search?q=${encodeURIComponent("工作")}&year=2015`,
);
const filteredIds = filtered.body.results.map(
  (result) => result.entry.id,
);
assert.ok(filteredIds.includes(yearEntry.id));
assert.ok(!filteredIds.includes(monthEntry.id));
assert.equal(filtered.body.timeFilter.label, "2015 年");
log("year filter", "2015 年工作只命中模糊年份记录");

const timeOnly = await json("/api/search?year=2015");
assert.equal(timeOnly.body.mode, "time");
assert.ok(
  timeOnly.body.results.some(
    (result) => result.entry.id === yearEntry.id,
  ),
);
assert.equal(timeOnly.body.timeFilter.label, "2015 年");
log("time-only browse", "按 2015 年列出记录");

const parsedTime = await json(
  `/api/search?q=${encodeURIComponent("2015 年我在做什么")}`,
);
assert.equal(parsedTime.body.mode, "time");
assert.equal(parsedTime.body.timeFilter.label, "2015 年");
assert.ok(
  parsedTime.body.results.some(
    (result) => result.entry.id === yearEntry.id,
  ),
);
log("time parser", "从自然语言识别出 2015 年");

const journalHtml = await (
  await fetch(`${BASE}/events?year=2015`)
).text();
assert.ok(journalHtml.includes(`在上海工作-${runId}`));
assert.ok(!journalHtml.includes(`大学毕业-${runId}`));
log("events year filter", "只显示 2015 年记录");

const recallHtml = await (
  await fetch(`${BASE}/search?year=2015`)
).text();
assert.ok(recallHtml.includes(`在上海工作-${runId}`));
log("search page", "2015 年记录可见");

const recallSearchHtml = await (
  await fetch(`${BASE}/search?q=${encodeURIComponent("上海工作")}`)
).text();
assert.ok(
  recallSearchHtml.includes(`/events/${yearEntry.id}`),
  "search result links to the matching entry",
);
log("search results", "搜索结果渲染并链接到原文");

const reindex = await json("/api/search/reindex", { method: "POST" });
assert.equal(reindex.response.status, 200);
assert.equal(reindex.body.failed, 0);
assert.ok(reindex.body.total >= 4);
assert.equal(
  reindex.body.status.indexedEntries,
  reindex.body.status.totalEntries,
);
log(
  "reindex",
  `${reindex.body.indexed}/${reindex.body.total} 条，${reindex.body.chunks} 个片段`,
);

for (const id of createdIds) {
  await fetch(`${BASE}/api/events/${id}`, { method: "DELETE" });
}
log("cleanup", "测试记录已删除");

console.log("\nSearch E2E passed.");
