import "server-only";

export const SUPPORTED_EMBEDDING_DIM = 1024;

const DEFAULT_BASE_URL =
  "https://dashscope.aliyuncs.com/compatible-mode/v1";
const DEFAULT_MODEL = "text-embedding-v3";

export type EmbeddingConfig = {
  baseUrl: string;
  model: string;
  dim: number;
  apiKey: string;
};

export type EmbeddingStatus = {
  configured: boolean;
  baseUrl: string;
  model: string;
  dim: number;
  keyConfigured: boolean;
  dimSupported: boolean;
  missing: string[];
};

function resolveApiKey() {
  return (
    process.env.EMBEDDING_API_KEY ??
    process.env.DASHSCOPE_API_KEY ??
    ""
  ).trim();
}

export function getEmbeddingStatus(): EmbeddingStatus {
  const baseUrl = (
    process.env.EMBEDDING_BASE_URL ?? DEFAULT_BASE_URL
  ).trim();
  const model = (process.env.EMBEDDING_MODEL ?? DEFAULT_MODEL).trim();
  const rawDim = Number(
    process.env.EMBEDDING_DIM ?? SUPPORTED_EMBEDDING_DIM,
  );
  const dimSupported = rawDim === SUPPORTED_EMBEDDING_DIM;
  const dim = Number.isFinite(rawDim)
    ? rawDim
    : SUPPORTED_EMBEDDING_DIM;
  const apiKey = resolveApiKey();
  const missing: string[] = [];

  if (!apiKey) missing.push("EMBEDDING_API_KEY");
  if (!baseUrl) missing.push("EMBEDDING_BASE_URL");
  if (!model) missing.push("EMBEDDING_MODEL");
  if (!dimSupported) {
    missing.push(`EMBEDDING_DIM=${SUPPORTED_EMBEDDING_DIM}`);
  }

  return {
    configured: missing.length === 0,
    baseUrl,
    model,
    dim,
    keyConfigured: Boolean(apiKey),
    dimSupported,
    missing,
  };
}

export function getEmbeddingConfig(): EmbeddingConfig | null {
  const status = getEmbeddingStatus();
  if (!status.configured) return null;

  return {
    baseUrl: status.baseUrl,
    model: status.model,
    dim: status.dim,
    apiKey: resolveApiKey(),
  };
}
