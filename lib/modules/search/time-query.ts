export type TimeFilter = {
  from: Date;
  to: Date;
  label: string;
};

export type ParsedTimeQuery = {
  filter: TimeFilter | null;
  cleaned: string;
};

const FILLERS =
  /^(这个时候|那个时候|的时候|那会儿|那时候|做什么|干了什么|在做什么|发生了什么|怎么样|如何|那些事|那些年)$/;

function cleanRemainder(text: string) {
  const cleaned = text
    .replace(/[？?。！!，,、；;：:]/g, " ")
    .replace(/(这个时候|那个时候|的时候|那会儿|那时候|在|我|的)/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned || FILLERS.test(cleaned)) return "";
  return cleaned;
}

function yearFilter(year: number): TimeFilter {
  return {
    from: new Date(year, 0, 1),
    to: new Date(year + 1, 0, 1),
    label: `${year} 年`,
  };
}

function monthFilter(year: number, monthIndex: number): TimeFilter {
  return {
    from: new Date(year, monthIndex, 1),
    to: new Date(year, monthIndex + 1, 1),
    label: `${year} 年 ${monthIndex + 1} 月`,
  };
}

function dayFilter(year: number, monthIndex: number, day: number): TimeFilter {
  return {
    from: new Date(year, monthIndex, day),
    to: new Date(year, monthIndex, day + 1),
    label: `${year} 年 ${monthIndex + 1} 月 ${day} 日`,
  };
}

function parseYearMonth(
  year: number,
  month: number,
): TimeFilter | null {
  if (!Number.isFinite(year) || month < 1 || month > 12) return null;
  return monthFilter(year, month - 1);
}

function parseYearMonthDay(
  year: number,
  month: number,
  day: number,
): TimeFilter | null {
  if (!Number.isFinite(year) || month < 1 || month > 12) return null;
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return dayFilter(year, month - 1, day);
}

/**
 * Rule-based Chinese time expression parsing. It is intentionally conservative:
 * if a phrase is not recognized, the query is left untouched.
 */
export function parseTimeQuery(
  query: string,
  now = new Date(),
): ParsedTimeQuery {
  const tests: Array<{
    regex: RegExp;
    build: (match: RegExpMatchArray) => TimeFilter | null;
  }> = [
    {
      regex: /(\d{4})\s*[-/年]\s*(\d{1,2})\s*[-/月]\s*(\d{1,2})\s*日?/,
      build: (match) =>
        parseYearMonthDay(
          Number(match[1]),
          Number(match[2]),
          Number(match[3]),
        ),
    },
    {
      regex: /(\d{4})\s*年\s*(\d{1,2})\s*月/,
      build: (match) =>
        parseYearMonth(Number(match[1]), Number(match[2])),
    },
    {
      regex: /(\d{4})[-/](\d{1,2})(?![-/]\d)/,
      build: (match) =>
        parseYearMonth(Number(match[1]), Number(match[2])),
    },
    {
      regex: /(\d{4})\s*年/,
      build: (match) => yearFilter(Number(match[1])),
    },
    {
      regex: /(今年|去年|前年|明年)/,
      build: (match) => {
        const offset =
          match[1] === "去年"
            ? -1
            : match[1] === "前年"
              ? -2
              : match[1] === "明年"
                ? 1
                : 0;
        return yearFilter(now.getFullYear() + offset);
      },
    },
    {
      regex: /(本月|这个月|上个月)/,
      build: (match) => {
        const offset = match[1] === "上个月" ? -1 : 0;
        return monthFilter(
          now.getFullYear(),
          now.getMonth() + offset,
        );
      },
    },
    {
      regex: /(今天|昨天|前天)/,
      build: (match) => {
        const offset =
          match[1] === "昨天" ? -1 : match[1] === "前天" ? -2 : 0;
        return dayFilter(
          now.getFullYear(),
          now.getMonth(),
          now.getDate() + offset,
        );
      },
    },
  ];

  for (const test of tests) {
    const match = query.match(test.regex);
    if (!match) continue;

    const filter = test.build(match);
    if (!filter) continue;

    return {
      filter,
      cleaned: cleanRemainder(query.replace(match[0], " ")),
    };
  }

  return { filter: null, cleaned: query.trim() };
}

export function yearRange(year: number): TimeFilter {
  return yearFilter(year);
}
