export const EVENT_CATEGORIES = [
  { value: "work", label: "工作" },
  { value: "health", label: "健康" },
  { value: "relationship", label: "关系" },
  { value: "learning", label: "学习" },
  { value: "finance", label: "财务" },
  { value: "life", label: "生活" },
  { value: "other", label: "其他" },
] as const;

export type EventCategory = (typeof EVENT_CATEGORIES)[number]["value"];

export function isEventCategory(value: unknown): value is EventCategory {
  return (
    typeof value === "string" &&
    EVENT_CATEGORIES.some((item) => item.value === value)
  );
}

export const EVENT_TYPES = [
  { value: "occurrence", label: "日常" },
  { value: "decision", label: "决定" },
  { value: "milestone", label: "转折点" },
  { value: "issue", label: "烦心事" },
  { value: "meeting", label: "见面" },
] as const;

export type EventType = (typeof EVENT_TYPES)[number]["value"];

export function isEventType(value: unknown): value is EventType {
  return (
    typeof value === "string" &&
    EVENT_TYPES.some((item) => item.value === value)
  );
}

export const IMPORTANCE_LEVELS = [
  { value: 1, label: "很轻" },
  { value: 2, label: "有点" },
  { value: 3, label: "一般" },
  { value: 4, label: "重要" },
  { value: 5, label: "很重要" },
] as const;

export const SENTIMENT_LEVELS = [
  { value: 1, label: "很低落" },
  { value: 2, label: "有点低落" },
  { value: 3, label: "平静" },
  { value: 4, label: "还不错" },
  { value: 5, label: "很开心" },
] as const;

export const SENSITIVITY_OPTIONS = [
  { value: "normal", label: "默认" },
  { value: "private", label: "私密" },
  { value: "local_only", label: "只在本机" },
] as const;

export function categoryLabel(value: string) {
  return (
    EVENT_CATEGORIES.find((item) => item.value === value)?.label ?? "其他"
  );
}

export function eventTypeLabel(value: string) {
  return (
    EVENT_TYPES.find((item) => item.value === value)?.label ?? "日常"
  );
}

export function importanceLabel(value: number | null | undefined) {
  return (
    IMPORTANCE_LEVELS.find((item) => item.value === value)?.label ?? "一般"
  );
}

export function sentimentLabel(value: number | null | undefined) {
  return (
    SENTIMENT_LEVELS.find((item) => item.value === value)?.label ?? "平静"
  );
}

export function sensitivityLabel(value: string) {
  return (
    SENSITIVITY_OPTIONS.find((item) => item.value === value)?.label ?? "默认"
  );
}
