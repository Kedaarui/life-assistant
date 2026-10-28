import "server-only";
import { getEmbeddingConfig } from "./embedding-config";

export class EmbeddingNotConfiguredError extends Error {
  constructor(message = "Embedding 尚未配置") {
    super(message);
    this.name = "EmbeddingNotConfiguredError";
  }
}

export class EmbeddingRequestError extends Error {
  status: number;
  detail: string;

  constructor(message: string, status: number, detail = "") {
    super(message);
    this.name = "EmbeddingRequestError";
    this.status = status;
    this.detail = detail;
  }
}

/**
 * Embed texts through any OpenAI-compatible /embeddings endpoint.
 * The returned vectors are validated against the configured dimension.
 */
export async function embedTexts(
  texts: string[],
  signal?: AbortSignal,
): Promise<number[][]> {
  if (texts.length === 0) return [];

  const config = getEmbeddingConfig();
  if (!config) throw new EmbeddingNotConfiguredError();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);
  const onAbort = () => controller.abort();
  signal?.addEventListener("abort", onAbort, { once: true });

  try {
    const response = await fetch(
      `${config.baseUrl.replace(/\/+$/, "")}/embeddings`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: config.model,
          input: texts,
        }),
        signal: controller.signal,
      },
    );

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new EmbeddingRequestError(
        `Embedding 服务返回了 ${response.status}`,
        response.status,
        detail.slice(0, 800),
      );
    }

    const payload = (await response.json()) as {
      data?: Array<{ embedding?: number[]; index?: number }>;
    };

    const items = Array.isArray(payload.data) ? [...payload.data] : [];
    items.sort((a, b) => (a.index ?? 0) - (b.index ?? 0));

    if (items.length !== texts.length) {
      throw new EmbeddingRequestError(
        "Embedding 返回数量与输入不一致",
        502,
        `expected ${texts.length}, got ${items.length}`,
      );
    }

    const vectors = items.map((item) => item.embedding);

    for (const vector of vectors) {
      if (!Array.isArray(vector)) {
        throw new EmbeddingRequestError("Embedding 返回格式不正确", 502);
      }
      if (vector.length !== config.dim) {
        throw new EmbeddingRequestError(
          `Embedding 维度不匹配：期望 ${config.dim}，实际 ${vector.length}`,
          502,
        );
      }
    }

    return vectors as number[][];
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", onAbort);
  }
}
