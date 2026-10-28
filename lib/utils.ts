export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function pad2(value: number) {
  return String(value).padStart(2, "0");
}

export function dayKey(date: Date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function dayRange(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const end = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
  return { start, end };
}

export function monthRange(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 1);
  return { start, end };
}

export function addDays(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + amount);
}

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

export function formatFullDate(date: Date) {
  return `${date.getFullYear()} 年 ${date.getMonth() + 1} 月 ${date.getDate()} 日 · 星期${WEEKDAYS[date.getDay()]}`;
}

export function formatMonth(date: Date) {
  return `${date.getFullYear()} 年 ${date.getMonth() + 1} 月`;
}

export function formatDay(date: Date) {
  return `${date.getMonth() + 1} 月 ${date.getDate()} 日`;
}

export function formatTime(date: Date) {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

export function formatDateTime(date: Date) {
  return `${formatDay(date)} ${formatTime(date)}`;
}

export function formatTimestamp(date: Date) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export function formatWeekday(date: Date) {
  return `周${WEEKDAYS[date.getDay()]}`;
}

export function sameDay(a: Date, b: Date) {
  return dayKey(a) === dayKey(b);
}

export function relativeDayLabel(date: Date, now = new Date()) {
  if (sameDay(date, now)) return "今天";
  if (sameDay(date, addDays(now, -1))) return "昨天";
  if (sameDay(date, addDays(now, 1))) return "明天";
  if (date.getFullYear() === now.getFullYear()) return formatDay(date);
  return `${date.getFullYear()} 年 ${formatDay(date)}`;
}

export function greeting(date: Date) {
  const hour = date.getHours();
  if (hour < 5) return "夜深了";
  if (hour < 11) return "早上好";
  if (hour < 14) return "中午好";
  if (hour < 18) return "下午好";
  return "晚上好";
}

export function excerpt(text: string, maxLength = 120) {
  const flattened = text.replace(/\s+/g, " ").trim();
  if (flattened.length <= maxLength) return flattened;
  return `${flattened.slice(0, maxLength)}…`;
}

export function firstLine(text: string) {
  const line = text
    .split(/\r?\n/)
    .map((item) => item.trim())
    .find(Boolean);
  if (!line) return "无题";
  return line.length > 80 ? `${line.slice(0, 80)}…` : line;
}

/**
 * When an entry has no explicit title, the first line acts as the heading and
 * the remainder is the body. This keeps the same text from being rendered twice.
 */
export function splitEntry(title: string | null, content: string) {
  if (title?.trim()) {
    return { heading: title.trim(), body: content.trim() };
  }

  const lines = content.split(/\r?\n/);
  const firstIndex = lines.findIndex((line) => line.trim().length > 0);
  if (firstIndex === -1) return { heading: "无题", body: "" };

  const heading = firstLine(content);
  const body = lines.slice(firstIndex + 1).join("\n").trim();
  return { heading, body };
}

export function toLocalInputValue(date: Date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(
    date.getDate(),
  )}T${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

export function fromLocalInputValue(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
