import "server-only";

export const PROVIDER_PRESETS = {
  deepseek: {
    label: "DeepSeek",
    baseUrl: "https://api.deepseek.com",
    model: "deepseek-chat",
    keyEnv: "DEEPSEEK_API_KEY",
  },
  glm: {
    label: "智谱 GLM",
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    model: "glm-4-plus",
    keyEnv: "GLM_API_KEY",
  },
  qwen: {
    label: "通义千问",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    model: "qwen-plus",
    keyEnv: "DASHSCOPE_API_KEY",
  },
  custom: {
    label: "自定义",
    baseUrl: "",
    model: "",
    keyEnv: "LLM_API_KEY",
  },
} as const;

export type ProviderId = keyof typeof PROVIDER_PRESETS;

export type LlmConfig = {
  provider: ProviderId;
  providerLabel: string;
  baseUrl: string;
  model: string;
  apiKey: string;
};

export type LlmSetupStatus = {
  configured: boolean;
  provider: ProviderId;
  providerLabel: string;
  baseUrl: string;
  model: string;
  keyConfigured: boolean;
  missing: string[];
};

function resolveProvider(): ProviderId {
  const raw = (process.env.LLM_PROVIDER ?? "deepseek").trim().toLowerCase();
  return raw in PROVIDER_PRESETS ? (raw as ProviderId) : "custom";
}

function resolveApiKey(provider: ProviderId) {
  const preset = PROVIDER_PRESETS[provider];
  const explicit = process.env.LLM_API_KEY?.trim();
  if (explicit) return explicit;
  if (preset.keyEnv !== "LLM_API_KEY") {
    return process.env[preset.keyEnv]?.trim() ?? "";
  }
  return "";
}

export function getLlmSetupStatus(): LlmSetupStatus {
  const provider = resolveProvider();
  const preset = PROVIDER_PRESETS[provider];
  const baseUrl = (process.env.LLM_BASE_URL ?? preset.baseUrl).trim();
  const model = (process.env.LLM_CHAT_MODEL ?? preset.model).trim();
  const apiKey = resolveApiKey(provider);
  const missing: string[] = [];

  if (!apiKey) missing.push("LLM_API_KEY");
  if (!baseUrl) missing.push("LLM_BASE_URL");
  if (!model) missing.push("LLM_CHAT_MODEL");

  return {
    configured: missing.length === 0,
    provider,
    providerLabel: preset.label,
    baseUrl,
    model,
    keyConfigured: Boolean(apiKey),
    missing,
  };
}

export function getLlmConfig(): LlmConfig | null {
  const status = getLlmSetupStatus();
  if (!status.configured) return null;

  return {
    provider: status.provider,
    providerLabel: status.providerLabel,
    baseUrl: status.baseUrl,
    model: status.model,
    apiKey: resolveApiKey(status.provider),
  };
}
