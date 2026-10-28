import assert from "node:assert/strict";

/**
 * End-to-end check for events, pages, and export.
 *
 * It only creates entries tagged with a unique run id, asserts against those,
 * and deletes exactly what it created. Existing data is never touched.
 *
 * Usage:
 *   LIFE_DATA_DIR=./.tmp-test-data npm run dev -- -p 3100
 *   BASE_URL=http://127.0.0.1:3100 npm run test:e2e
 */

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3100";
const runId = Date.now().toString(36);
const marker = `e2e-${runId}`;

async function json(path, options) {
  const response = await fetch(`${BASE}${path}`, options);
  const body = await response.json();
  return { response, body };
}

async function getHtml(path) {
  const response = await fetch(`${BASE}${path}`);
  return { response, html: await response.text() };
}

function log(name, detail = "") {
  console.log(`✓ ${name}${detail ? ` — ${detail}` : ""}`);
}

const healthBefore = await json("/api/health");
assert.equal(healthBefore.body.ok, true);
const initialCount = healthBefore.body.events;
log(
  "health",
  `sqlite ${healthBefore.body.sqlite}, vec ${healthBefore.body.vector}, ${initialCount} 条已有事件`,
);

const createdAt = "2026-10-28T09:30:00+08:00";
const created = await json("/api/events", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    title: `需求评审-${runId}`,
    description: `与团队完成需求评审。${marker}`,
    eventTime: createdAt,
    eventPrecision: "datetime",
    sentiment: 4,
    category: "work",
    eventType: "meeting",
    importance: 4,
    outcome: "确定三项需求进入开发。",
    people: ["张三"],
    tags: [`项目-${runId}`, "评审"],
  }),
});

assert.equal(created.response.status, 201);
assert.equal(created.body.event.title, `需求评审-${runId}`);
assert.equal(created.body.event.sentiment, 4);
assert.equal(created.body.event.category, "work");
assert.equal(created.body.event.eventType, "meeting");
assert.equal(created.body.event.importance, 4);
assert.deepEqual(
  created.body.event.people.map((person) => person.name),
  ["张三"],
);
assert.deepEqual(
  created.body.event.tags.map((tag) => tag.name).sort(),
  ["评审", `项目-${runId}`].sort(),
);
assert.equal(
  new Date(created.body.event.eventTime).toISOString(),
  new Date(createdAt).toISOString(),
);
const eventA = created.body.event;
log("create event", eventA.title);

const second = await json("/api/events", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    title: `傍晚散步-${runId}`,
    description: `傍晚沿着河边走了很久。${marker}`,
    eventPrecision: "datetime",
    tags: [`散步-${runId}`],
  }),
});
assert.equal(second.response.status, 201);
const eventB = second.body.event;
log("create quick event", eventB.id.slice(0, 8));

const search = await json(`/api/events?q=${encodeURIComponent(marker)}`);
assert.equal(search.body.events.length, 2);
log("search events", `唯一标记命中 ${search.body.events.length} 条`);

const patched = await json(`/api/events/${eventA.id}`, {
  method: "PATCH",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    sentiment: 5,
    importance: 5,
    tags: [`项目-${runId}`, `里程碑-${runId}`],
    eventTime: "2026-10-27T21:00:00+08:00",
  }),
});
assert.equal(patched.response.status, 200);
assert.equal(patched.body.event.sentiment, 5);
assert.equal(patched.body.event.importance, 5);
assert.deepEqual(
  patched.body.event.tags.map((tag) => tag.name).sort(),
  [`里程碑-${runId}`, `项目-${runId}`].sort(),
);
log("patch event", "情绪、重要性、标签、发生时间均已更新");

const tagFilter = await json(
  `/api/events?tag=${encodeURIComponent(`里程碑-${runId}`)}`,
);
assert.equal(tagFilter.body.events.length, 1);
assert.equal(tagFilter.body.events[0].id, eventA.id);
log("tag filter", "唯一标签命中 1 条");

const exported = await fetch(`${BASE}/api/export`);
assert.equal(exported.status, 200);
assert.match(
  exported.headers.get("content-disposition") ?? "",
  /life-assistant-events-\d{4}-\d{2}-\d{2}\.json/,
);
const exportBody = await exported.json();
const exportedIds = new Set(
  exportBody.events.map((event) => event.id),
);
assert.ok(exportedIds.has(eventA.id) && exportedIds.has(eventB.id));
assert.ok(exportBody.eventCount >= initialCount + 2);
log("export", `${exportBody.eventCount} 条，包含本轮测试事件`);

const pages = [
  ["/", "最近事件"],
  ["/events", "管理生活与工作中的事件记录"],
  [`/events/${eventA.id}`, `需求评审-${runId}`],
  [`/events/${eventA.id}/edit`, "事件描述"],
  ["/events/new", "事件标题"],
  ["/assistant", "基于事件记录进行分析、复盘与讨论"],
  ["/search", "检索你记录过的事件与细节"],
  ["/settings", "本地数据"],
];

for (const [path, pageMarker] of pages) {
  const { response, html } = await getHtml(path);
  assert.equal(response.status, 200, `${path} status`);
  assert.ok(html.includes(pageMarker), `${path} contains ${pageMarker}`);
  log(`page ${path}`, `200 · 含「${pageMarker}」`);
}

const home = await getHtml("/");
assert.ok(
  home.html.includes(`傍晚散步-${runId}`),
  "dashboard shows the event created just now",
);
log("dashboard shows new event");

const detail = await getHtml(`/events/${eventA.id}`);
assert.ok(detail.html.includes("确定三项需求进入开发"));
log("detail renders outcome");

const missing = await fetch(`${BASE}/events/not-a-real-id`);
const missingHtml = await missing.text();
assert.ok(
  missing.status === 404 || missingHtml.includes("页面不存在"),
  "missing event renders the not-found page",
);
log("missing event", `status ${missing.status} · 渲染未找到页面`);

await fetch(`${BASE}/api/events/${eventB.id}`, { method: "DELETE" });
await fetch(`${BASE}/api/events/${eventA.id}`, { method: "DELETE" });

const finalSearch = await json(
  `/api/events?q=${encodeURIComponent(marker)}`,
);
assert.equal(finalSearch.body.events.length, 0);
const finalHealth = await json("/api/health");
assert.equal(finalHealth.body.events, initialCount);
log("delete", `测试事件已清理，事件数回到 ${initialCount}`);

console.log("\nEvents E2E passed.");
