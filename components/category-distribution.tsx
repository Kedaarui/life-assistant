import {
  categoryLabel,
  type EventCategory,
} from "@/lib/event-meta";

export function CategoryDistribution({
  data,
}: {
  data: { category: EventCategory; count: number }[];
}) {
  if (data.length === 0) {
    return (
      <p className="py-6 text-center text-[11px] text-ink-faint">
        近 90 天还没有记录
      </p>
    );
  }

  const max = Math.max(...data.map((item) => item.count));
  const total = data.reduce((sum, item) => sum + item.count, 0);

  return (
    <div className="space-y-2.5">
      {data.map((item) => (
        <div key={item.category} className="flex items-center gap-3">
          <span className="w-10 shrink-0 text-[12px] text-ink-soft">
            {categoryLabel(item.category)}
          </span>
          <div className="h-1.5 flex-1 rounded-full bg-line/70">
            <div
              className="h-1.5 rounded-full bg-accent"
              style={{
                width: `${Math.max((item.count / max) * 100, 3)}%`,
              }}
            />
          </div>
          <span className="display-nums w-6 text-right font-display text-[12px] text-ink-soft">
            {item.count}
          </span>
        </div>
      ))}
      <p className="pt-1 text-[11px] text-ink-faint">合计 {total} 条</p>
    </div>
  );
}
