import { formatTime, fromLocalInputValue, pad2 } from "./utils";

export const TIME_PRECISIONS = [
  { value: "datetime", label: "具体时间", hint: "年月日 时:分" },
  { value: "day", label: "仅日期", hint: "知道哪一天" },
  { value: "month", label: "仅月份", hint: "只记得哪个月" },
  { value: "year", label: "仅年份", hint: "只记得哪一年" },
] as const;

export type TimePrecision = (typeof TIME_PRECISIONS)[number]["value"];

export function isTimePrecision(value: unknown): value is TimePrecision {
  return (
    typeof value === "string" &&
    TIME_PRECISIONS.some((precision) => precision.value === value)
  );
}

export function precisionLabel(value: string) {
  return (
    TIME_PRECISIONS.find((precision) => precision.value === value)?.label ??
    "具体时间"
  );
}

export type EventPeriod = {
  eventTime: Date;
  eventTimeEnd: Date | null;
};

/**
 * Snap a date to the start of its precision period and compute the exclusive
 * end. Coarse entries get a range so time filters can use overlap semantics.
 */
export function normalizeEventPeriod(
  date: Date,
  precision: TimePrecision,
): EventPeriod {
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();

  switch (precision) {
    case "year":
      return {
        eventTime: new Date(year, 0, 1),
        eventTimeEnd: new Date(year + 1, 0, 1),
      };
    case "month":
      return {
        eventTime: new Date(year, month, 1),
        eventTimeEnd: new Date(year, month + 1, 1),
      };
    case "day":
      return {
        eventTime: new Date(year, month, day),
        eventTimeEnd: new Date(year, month, day + 1),
      };
    default:
      return { eventTime: date, eventTimeEnd: null };
  }
}

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

export function formatEntryPeriod(
  date: Date,
  precision: TimePrecision,
  timeNote?: string | null,
) {
  const note = timeNote?.trim() ? ` · ${timeNote.trim()}` : "";
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();

  switch (precision) {
    case "year":
      return `${year} 年${note}`;
    case "month":
      return `${year} 年 ${month} 月${note}`;
    case "day":
      return `${year} 年 ${month} 月 ${day} 日${note}`;
    default:
      return `${year} 年 ${month} 月 ${day} 日 · 星期${
        WEEKDAYS[date.getDay()]
      } ${formatTime(date)}${note}`;
  }
}

export function eventDateParts(date: Date, precision: TimePrecision) {
  const year = date.getFullYear();
  const month = pad2(date.getMonth() + 1);
  const day = pad2(date.getDate());

  switch (precision) {
    case "year":
      return { primary: `${year}`, secondary: "仅年份" };
    case "month":
      return { primary: `${year}-${month}`, secondary: "仅月份" };
    case "day":
      return { primary: `${year}-${month}-${day}`, secondary: "全天" };
    default:
      return {
        primary: `${year}-${month}-${day}`,
        secondary: `${pad2(date.getHours())}:${pad2(
          date.getMinutes(),
        )}`,
      };
  }
}

export function followUpState(date: Date, now = new Date()) {
  const due = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );
  const today = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );
  const diff = Math.round(
    (due.getTime() - today.getTime()) / 86_400_000,
  );

  if (diff < 0) {
    return {
      tone: "overdue" as const,
      label: `已过 ${Math.abs(diff)} 天`,
    };
  }
  if (diff === 0) {
    return { tone: "today" as const, label: "就在今天" };
  }
  return {
    tone: "upcoming" as const,
    label: `${date.getMonth() + 1} 月 ${date.getDate()} 日`,
  };
}

export function formatEntryPeriodShort(date: Date, precision: TimePrecision) {
  const year = date.getFullYear();
  const month = pad2(date.getMonth() + 1);
  const day = pad2(date.getDate());

  switch (precision) {
    case "year":
      return `${year}`;
    case "month":
      return `${year}.${month}`;
    case "day":
      return `${month}.${day}`;
    default:
      return `${month}.${day}`;
  }
}

export function formatEntryTimeLabel(precision: TimePrecision) {
  switch (precision) {
    case "year":
      return "仅年份";
    case "month":
      return "仅月份";
    case "day":
      return "全天";
    default:
      return "";
  }
}

export function formatCitationDate(
  date: Date,
  precision: TimePrecision,
  now = new Date(),
) {
  const yearPrefix =
    date.getFullYear() === now.getFullYear() ? "" : `${date.getFullYear()} 年`;

  switch (precision) {
    case "year":
      return `${date.getFullYear()} 年`;
    case "month":
      return `${date.getFullYear()} 年 ${date.getMonth() + 1} 月`;
    default:
      return `${yearPrefix}${date.getMonth() + 1} 月 ${date.getDate()} 日`;
  }
}

export function entryGroup(date: Date, precision: TimePrecision) {
  const year = date.getFullYear();
  if (precision === "year") {
    return {
      key: `${year}-year`,
      label: `${year} 年 · 模糊时间`,
    };
  }
  return {
    key: `${year}-${date.getMonth()}`,
    label: `${year} 年 ${date.getMonth() + 1} 月`,
  };
}

export function toPrecisionInputValue(
  date: Date,
  precision: TimePrecision,
) {
  const year = date.getFullYear();
  const month = pad2(date.getMonth() + 1);
  const day = pad2(date.getDate());

  switch (precision) {
    case "year":
      return `${year}`;
    case "month":
      return `${year}-${month}`;
    case "day":
      return `${year}-${month}-${day}`;
    default:
      return `${year}-${month}-${day}T${pad2(date.getHours())}:${pad2(
        date.getMinutes(),
      )}`;
  }
}

export function parsePrecisionInput(
  value: string,
  precision: TimePrecision,
): Date | null {
  const trimmed = value.trim();

  if (precision === "year") {
    if (!/^\d{4}$/.test(trimmed)) return null;
    const year = Number(trimmed);
    if (year < 1000 || year > 3000) return null;
    return new Date(year, 0, 1);
  }

  if (precision === "month") {
    if (!/^\d{4}-\d{2}$/.test(trimmed)) return null;
    const [year, month] = trimmed.split("-").map(Number);
    if (month < 1 || month > 12) return null;
    return new Date(year, month - 1, 1);
  }

  if (precision === "day") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
    const [year, month, day] = trimmed.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    ) {
      return null;
    }
    return date;
  }

  const date = fromLocalInputValue(trimmed);
  if (!date) return null;
  return date;
}
