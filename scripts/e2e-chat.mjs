import assert from "node:assert/strict";

/**
 * Assistant E2E against a running app configured with the mock LLM.
 *
 * Recommended setup (fresh data dir):
 *   npm run mock:llm
 *   LIFE_DATA_DIR=./.tmp-chat-data \
 *     LLM_PROVIDER=custom LLM_API_KEY=mock \
 *     LLM_BASE_URL=http://127.0.0.1:3300/v1 LLM_CHAT_MODEL=mock-model \
 *     npm run dev -- -p 3100
 *   BASE_URL=http://127.0.0.1:3100 npm run test:chat
 *
 * The script only creates and deletes its own events. Test conversations are
 * intentionally left behind; use a throwaway LIFE_DATA_DIR.
 */

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3100";
const MOCK_URL = process.env.MOCK_URL ?? "http://127.0.0.1:3300";
const runId = Date.now().toString(36);
const marker = `chat-${runId}`;
const localOnlySecret = `LOCAL_ONLY_SECRET_${runId}`;

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

function parseSse(chunk) {
  let event = "message";
  let data = "";

  for (const line of chunk.split(/\r?\n/)) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) data += line.slice(5).trim();
  }

  return { event, data };
}

const older = await json("/api/events", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    title: `项目记录-${runId}`,
    description: `最近一直在推进项目，有点累，但也在往前走。${marker}`,
    eventTime: "2026-10-27T21:00:00+08:00",
    eventPrecision: "datetime",
    sentiment: 3,
    category: "work",
    eventType: "occurrence",
    importance: 4,
    tags: [`聊天测试-${runId}`],
  }),
});
assert.equal(older.response.status, 201);

const newer = await json("/api/events", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    title: `傍晚散步-${runId}`,
    description: `沿着河边走了很久，风很舒服，脑子也松了一点。${marker}`,
    eventTime: "2026-10-28T18:30:00+08:00",
    eventPrecision: "datetime",
    sentiment: 4,
    category: "health",
    eventType: "occurrence",
    importance: 2,
    tags: [`聊天测试-${runId}`],
  }),
});
assert.equal(newer.response.status, 201);

const secret = await json("/api/events", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    title: `只给自己看-${runId}`,
    description: `${localOnlySecret} 这件事只应该留在本地。`,
    eventTime: "2026-10-28T23:00:00+08:00",
    eventPrecision: "datetime",
    sensitivity: "local_only",
  }),
});
assert.equal(secret.response.status, 201);
log("seed events", "2 条普通事件 + 1 条仅本地事件");

const question = `复盘一下最近的状态 ${runId}`;
const response = await fetch(`${BASE}/api/chat`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ message: question, mode: "review" }),
});

assert.equal(response.status, 200);
assert.match(
  response.headers.get("content-type") ?? "",
  /text\/event-stream/,
);

const reader = response.body.getReader();
const decoder = new TextDecoder();
const events = [];
let buffer = "";

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  buffer += decoder.decode(value, { stream: true });
  const parts = buffer.split("\n\n");
  buffer = parts.pop() ?? "";

  for (const part of parts) {
    const parsed = parseSse(part);
    if (!parsed.data) continue;
    events.push({ event: parsed.event, data: JSON.parse(parsed.data) });
  }
}

const meta = events.find((event) => event.event === "meta")?.data;
const done = events.find((event) => event.event === "done")?.data;
const deltas = events.filter((event) => event.event === "delta");
const errors = events.filter((event) => event.event === "error");

assert.ok(meta, "meta event received");
assert.ok(done, "done event received");
assert.equal(errors.length, 0, "no error events");
assert.ok(deltas.length >= 5, "text arrived in multiple deltas");
assert.ok(meta.contextEntries >= 2, "events were included");
assert.ok(meta.citations.length >= 2, "citation map was returned");
assert.equal(done.message.role, "assistant");
assert.match(done.message.content, /\[\[E\d+\]\]/);
assert.ok(
  done.message.citations.length >= 2,
  "assistant message cites events",
);
log(
  "stream",
  `${deltas.length} 个增量 · 上下文 ${meta.contextEntries} 条 · 引用 ${done.message.citations.length} 个`,
);

const lastRequestResponse = await fetch(`${MOCK_URL}/last-request`);
assert.equal(lastRequestResponse.status, 200);
const lastRequest = await lastRequestResponse.json();
assert.ok(
  lastRequest.systemPrompt.includes(`项目记录-${runId}`),
  "normal events are sent to the model",
);
assert.ok(
  !lastRequest.systemPrompt.includes(localOnlySecret),
  "local_only events never reach the model",
);

const secretSearch = await json(
  `/api/search?q=${encodeURIComponent(localOnlySecret)}`,
);
assert.ok(
  secretSearch.body.results.every(
    (result) => result.entry.id !== secret.body.event.id,
  ),
  "local_only events never appear in search results",
);
log("privacy", "仅本地事件不进入提示词，也不进入检索结果");

const citation = done.message.citations[0];
const conversationId = meta.conversationId;
const assistantText = done.message.content.slice(0, 12);

const detail = await getHtml(`/assistant/${conversationId}`);
assert.equal(detail.response.status, 200);
assert.ok(detail.html.includes(assistantText), "assistant text is rendered");
assert.ok(
  detail.html.includes(`/events/${citation.entryId}`),
  "citation links back to the source event",
);
log(
  "assistant detail page",
  `渲染引用 → /events/${citation.entryId.slice(0, 8)}`,
);

const list = await getHtml("/assistant");
assert.equal(list.response.status, 200);
assert.ok(list.html.includes(question), "conversation title appears in list");
assert.ok(list.html.includes("复盘"), "mode label appears");
log("assistant list page", "会话标题与模式已显示");

await fetch(`${BASE}/api/events/${older.body.event.id}`, {
  method: "DELETE",
});
await fetch(`${BASE}/api/events/${newer.body.event.id}`, {
  method: "DELETE",
});
await fetch(`${BASE}/api/events/${secret.body.event.id}`, {
  method: "DELETE",
});
log("cleanup", "测试事件已删除（测试会话保留在测试库中）");

console.log("\nAssistant E2E passed.");
