"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

type TrendPoint = {
  key: string;
  label: string;
  count: number;
};

export function MonthlyTrendChart({ data }: { data: TrendPoint[] }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const max = Math.max(...data.map((point) => point.count), 0);

  if (max === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-[11px] text-ink-faint">
        近 6 个月还没有记录
      </div>
    );
  }

  const niceMax = max <= 4 ? max : Math.ceil(max / 5) * 5;
  const ticks =
    niceMax <= 4 ? [0, niceMax] : [0, Math.round(niceMax / 2), niceMax];
  const latest = data[data.length - 1];
  const total = data.reduce((sum, point) => sum + point.count, 0);

  return (
    <div>
      <div className="mb-2 flex h-5 items-center justify-between">
        <span className="text-[11px] text-ink-soft">
          {hovered !== null
            ? `${data[hovered].label} · ${data[hovered].count} 条记录`
            : `最近 ${latest.label} · ${latest.count} 条`}
        </span>
        <span className="text-[11px] text-ink-faint">合计 {total} 条</span>
      </div>

      <div className="relative ml-7 h-36">
        {ticks.map((tick) => (
          <div
            key={tick}
            className={cn(
              "absolute inset-x-0 border-t",
              tick === 0 ? "border-line-strong" : "border-line",
            )}
            style={{ bottom: `${(tick / niceMax) * 100}%` }}
          >
            <span className="display-nums absolute -left-7 -translate-y-1/2 font-display text-[11px] text-ink-faint">
              {tick}
            </span>
          </div>
        ))}

        <div className="flex h-full items-end gap-2">
          {data.map((point, index) => {
            const height =
              point.count > 0
                ? Math.max((point.count / niceMax) * 100, 2)
                : 0;

            return (
              <button
                key={point.key}
                type="button"
                onMouseEnter={() => setHovered(index)}
                onMouseLeave={() => setHovered(null)}
                onFocus={() => setHovered(index)}
                onBlur={() => setHovered(null)}
                className="group flex h-full flex-1 items-end justify-center rounded-sm focus:outline-none"
                aria-label={`${point.label}：${point.count} 条记录`}
              >
                <span
                  className={cn(
                    "w-[22px] rounded-t-[4px] transition",
                    point.count > 0 ? "bg-accent" : "bg-line",
                    hovered === index && "bg-accent-deep",
                  )}
                  style={{ height: `${height}%` }}
                />
              </button>
            );
          })}
        </div>
      </div>

      <div className="ml-7 mt-2 flex gap-2">
        {data.map((point) => (
          <span
            key={point.key}
            className="flex-1 text-center text-[11px] text-ink-faint"
          >
            {point.label}
          </span>
        ))}
      </div>

      <table className="sr-only">
        <caption>近 6 个月的记录</caption>
        <thead>
          <tr>
            <th>月份</th>
            <th>数量</th>
          </tr>
        </thead>
        <tbody>
          {data.map((point) => (
            <tr key={point.key}>
              <td>{point.label}</td>
              <td>{point.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
