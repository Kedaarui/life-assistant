import "server-only";
import { getLlmConfig } from "./config";

export type LlmMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export class LlmNotConfiguredError extends Error {
  constructor(message = "LLM 尚未配置") {
    super(message);
    this.name = "LlmNotConfiguredError";
  }
}

export class LlmRequestError extends Error {
  status: number;
  detail: string;

  constructor(message: string, status: number, detail = "") {
    super(message);
    this.name = "LlmRequestError";
    this.status = status;
    this.detail = detail;
  }
}

type StreamOptions = {
  signal?: AbortSignal;
  temperature?: number;
  maxTokens?: number;
};

/**
 * Stream chat completions from any OpenAI-compatible endpoint.
 *
 * Yields text deltas only. Reasoning fields and tool calls are intentionally
 * ignored in P1; retrieval tools arrive in P2.
 */
export async function* streamCompletion(
  messages: LlmMessage[],
  options: StreamOptions = {},
): AsyncGenerator<string, void, void> {
  const config = getLlmConfig();
  if (!config) throw new LlmNotConfiguredError();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000);
  const onAbort = () => controller.abort();
  options.signal?.addEventListener("abort", onAbort, { once: true });

  try {
    const response = await fetch(
      `${config.baseUrl.replace(/\/+$/, "")}/chat/completions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: config.model,
          messages,
          stream: true,
          temperature: options.temperature ?? 0.7,
          max_tokens: options.maxTokens ?? 2048,
        }),
        signal: controller.signal,
      },
    );

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new LlmRequestError(
        `模型返回了 ${response.status}`,
        response.status,
        detail.slice(0, 800),
      );
    }

    if (!response.body) {
      throw new LlmRequestError("模型没有返回响应体", 502);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split(/\r?\n\r?\n/);
        buffer = events.pop() ?? "";

        for (const event of events) {
          for (const line of event.split(/\r?\n/)) {
            if (!line.startsWith("data:")) continue;
            const data = line.slice(5).trim();
            if (!data || data === "[DONE]") continue;

            let parsed: unknown;
            try {
              parsed = JSON.parse(data);
            } catch {
              continue;
            }

            const delta = (
              parsed as {
                choices?: Array<{ delta?: { content?: unknown } }>;
              }
            ).choices?.[0]?.delta?.content;

            if (typeof delta === "string" && delta.length > 0) {
              yield delta;
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener("abort", onAbort);
  }
}
