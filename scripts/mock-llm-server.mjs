import http from "node:http";

/**
 * Minimal OpenAI-compatible chat-completions server for local development.
 *
 *   npm run mock:llm
 *
 * Then point the app at it:
 *   LLM_PROVIDER=custom
 *   LLM_API_KEY=mock
 *   LLM_BASE_URL=http://127.0.0.1:3300/v1
 *   LLM_CHAT_MODEL=mock-model
 */

const PORT = Number(process.env.PORT ?? 3300);
const DELAY_MS = Number(process.env.MOCK_DELAY_MS ?? 18);
let lastSystemPrompt = "";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function chunksOf(text, size = 8) {
  const characters = Array.from(text);
  const chunks = [];
  for (let index = 0; index < characters.length; index += size) {
    chunks.push(characters.slice(index, index + size).join(""));
  }
  return chunks;
}

const EMBEDDING_DIM = 1024;

/**
 * Deterministic bag-of-character-bigrams embedding. It is not semantically
 * smart, but similar Chinese text shares features, which is enough to exercise
 * the hybrid retrieval pipeline end to end.
 */
function embedText(text) {
  const vector = new Array(EMBEDDING_DIM).fill(0);
  const characters = Array.from(text.toLowerCase()).filter(
    (character) => !/\s/.test(character),
  );
  const features = [...characters];

  for (let index = 0; index < characters.length - 1; index += 1) {
    features.push(characters[index] + characters[index + 1]);
  }

  for (const feature of features) {
    let hash = 2166136261;
    for (let index = 0; index < feature.length; index += 1) {
      hash ^= feature.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    vector[(hash >>> 0) % EMBEDDING_DIM] += 1;
  }

  const norm =
    Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
  return vector.map((value) => value / norm);
}

function buildReply(systemPrompt) {
  const refs = [
    ...new Set(
      [...systemPrompt.matchAll(/^\[(E\d+)\]/gm)].map(
        (match) => match[1],
      ),
    ),
  ];

  if (refs.length === 0) {
    return "你还没有记录事件。先记录一件具体发生的事，包括时间、相关人物和结果，我才能基于事实进行分析。";
  }

  const latest = refs[refs.length - 1];
  const previous = refs.length > 1 ? refs[refs.length - 2] : null;

  if (!previous) {
    return `我查看了你记录的事件。从最近的记录看，你在一件事上投入了不少精力，这件事值得继续观察。[[${latest}]]

建议下一步明确一个可验证的小目标，并在事件记录里写下预期结果；到复盘日期时再对照实际结果。`;
  }

  return `我查看了你记录的事件。有两点比较明显：

1. 你最近在重要事项上投入了较多精力，这件事值得持续跟进。[[${latest}]]
2. 你也记录了恢复和缓冲的时刻，这对维持长期节奏是必要的。[[${previous}]]

从目前的事件记录看，建议先区分「推进」和「恢复」两个目标，再决定这周的安排顺序。两者并不冲突，但优先级会影响你的资源分配。`;
}

const server = http.createServer(async (request, response) => {
  if (request.method === "GET" && request.url === "/health") {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ ok: true, mode: "mock" }));
    return;
  }

  if (request.method === "GET" && request.url === "/last-request") {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ systemPrompt: lastSystemPrompt }));
    return;
  }

  if (request.method === "POST" && request.url?.endsWith("/embeddings")) {
    if (!request.headers.authorization?.startsWith("Bearer ")) {
      response.writeHead(401, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ error: "missing api key" }));
      return;
    }

    let raw = "";
    for await (const chunk of request) raw += chunk;

    let payload = {};
    try {
      payload = JSON.parse(raw);
    } catch {
      response.writeHead(400, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ error: "invalid json" }));
      return;
    }

    const input = Array.isArray(payload.input)
      ? payload.input
      : [payload.input];
    const data = input.map((text, index) => ({
      object: "embedding",
      index,
      embedding: embedText(String(text ?? "")),
    }));

    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(
      JSON.stringify({
        object: "list",
        data,
        model: payload.model ?? "mock-embedding",
      }),
    );
    return;
  }

  if (
    request.method !== "POST" ||
    !request.url?.endsWith("/chat/completions")
  ) {
    response.writeHead(404, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ error: "not found" }));
    return;
  }

  if (!request.headers.authorization?.startsWith("Bearer ")) {
    response.writeHead(401, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ error: "missing api key" }));
    return;
  }

  let rawBody = "";
  for await (const chunk of request) {
    rawBody += chunk;
  }

  let payload = {};
  try {
    payload = JSON.parse(rawBody);
  } catch {
    response.writeHead(400, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ error: "invalid json" }));
    return;
  }

  const messages = Array.isArray(payload.messages) ? payload.messages : [];
  const systemPrompt = messages
    .filter((message) => message.role === "system")
    .map((message) => message.content)
    .join("\n");

  lastSystemPrompt = systemPrompt;
  const reply = buildReply(systemPrompt);

  response.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  for (const chunk of chunksOf(reply)) {
    response.write(
      `data: ${JSON.stringify({
        choices: [{ delta: { content: chunk } }],
      })}\n\n`,
    );
    await sleep(DELAY_MS);
  }

  response.write("data: [DONE]\n\n");
  response.end();
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Mock LLM listening on http://127.0.0.1:${PORT}/v1`);
  console.log("Point the app at it with LLM_PROVIDER=custom + LLM_BASE_URL.");
});

process.on("SIGINT", () => {
  server.close(() => process.exit(0));
});
