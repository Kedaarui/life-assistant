export const CHAT_MODES = [
  { value: "companion", label: "聊聊", hint: "说说最近" },
  { value: "advice", label: "梳理", hint: "理清头绪" },
  { value: "brainstorm", label: "一起想", hint: "想想办法" },
  { value: "review", label: "回看", hint: "看看过去" },
] as const;

export type ChatMode = (typeof CHAT_MODES)[number]["value"];

export function isChatMode(value: unknown): value is ChatMode {
  return (
    typeof value === "string" &&
    CHAT_MODES.some((mode) => mode.value === value)
  );
}

export function chatModeLabel(value: string) {
  return CHAT_MODES.find((mode) => mode.value === value)?.label ?? "聊聊";
}

export function chatModeHint(value: string) {
  return CHAT_MODES.find((mode) => mode.value === value)?.hint ?? "";
}
