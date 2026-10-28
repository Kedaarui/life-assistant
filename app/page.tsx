import Link from "next/link";
import { Plus } from "lucide-react";
import { CategoryDistribution } from "@/components/category-distribution";
import { EventRow } from "@/components/event-row";
import { PageHeader } from "@/components/page-header";
import { QuickEvent } from "@/components/quick-event";
import {
  getCategoryCounts,
  getStats,
  listEntries,
  type EntryWithTags,
} from "@/lib/modules/entries/service";
import {
  btnPrimary,
  cardClass,
  cardTitleClass,
} from "@/lib/ui";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

function daysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

function getMood(entries: EntryWithTags[]) {
  const withMood = entries.filter(
    (entry) => entry.sentiment !== null,
  );

  if (withMood.length === 0) {
    return {
      label: "还没有记下",
      detail: "记的时候顺手选一下心情，慢慢就能看出变化。",
    };
  }

  const values = withMood.map((entry) => entry.sentiment!);
  const average =
    values.reduce((sum, value) => sum + value, 0) / values.length;
  const label =
    average >= 4.2
      ? "轻快"
      : average >= 3.4
        ? "偏积极"
        : average >= 2.6
          ? "比较平静"
          : average >= 1.8
            ? "有点低"
            : "有些低落";

  const happy = values.filter((value) => value >= 4).length;
  const calm = values.filter((value) => value === 3).length;
  const low = values.filter((value) => value <= 2).length;

  return {
    label,
    detail: `开心 ${happy} 次，平静 ${calm} 次，低落 ${low} 次。`,
  };
}

function getTopPeople(entries: EntryWithTags[]) {
  const counts = new Map<string, number>();

  for (const entry of entries) {
    for (const person of entry.people) {
      counts.set(person.name, (counts.get(person.name) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);
}

export default function TodayPage() {
  const stats = getStats();
  const recentAll = listEntries({ limit: 200, order: "desc" });
  const recent = recentAll.slice(0, 6);
  const recentMood = recentAll.filter(
    (entry) => entry.eventTime >= daysAgo(30),
  );
  const recentPeople = recentAll.filter(
    (entry) => entry.eventTime >= daysAgo(90),
  );
  const categories = getCategoryCounts(90);
  const mood = getMood(recentMood);
  const topPeople = getTopPeople(recentPeople);

  return (
    <div>
      <PageHeader
        title="今天"
        description="记下此刻，也看看最近的日子。"
        actions={
          <Link href="/events/new" className={btnPrimary}>
            <Plus size={15} />
            记一件事
          </Link>
        }
      />

      <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 border-y border-line/70 py-3 text-[12.5px] text-ink-soft">
        <span>
          <span className="display-nums font-display text-[16px] text-ink">
            {stats.total}
          </span>{" "}
          件记下的事
        </span>
        <span>
          连续记录{" "}
          <span className="display-nums font-display text-[16px] text-ink">
            {stats.streak}
          </span>{" "}
          天
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
          最近的心情 · {mood.label === "还没有记下" ? "还没记下" : mood.label}
        </span>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-5">
          <QuickEvent />

          <section>
            <div className="flex items-end justify-between gap-3">
              <div>
                <h2 className="text-[15px] font-semibold text-ink">
                  最近的日子
                </h2>
                <p className="mt-0.5 text-[11px] text-ink-faint">
                  按发生时间倒序
                </p>
              </div>
              <Link
                href="/events"
                className="text-[12px] font-medium text-accent transition hover:text-accent-deep"
              >
                全部记录
              </Link>
            </div>

            <div className="mt-3 overflow-hidden rounded-xl border border-line bg-surface shadow-card">
              {recent.length > 0 ? (
                <div>
                  {recent.map((event) => (
                    <EventRow key={event.id} event={event} />
                  ))}
                </div>
              ) : (
                <div className="px-5 py-12 text-center">
                  <p className="text-[14px] font-medium text-ink">
                    还没有记下什么
                  </p>
                  <p className="mt-1 text-[12px] text-ink-faint">
                    从上方写下第一件刚刚发生的事。
                  </p>
                </div>
              )}
            </div>
          </section>
        </div>

        <div className="space-y-5">
          <section className={cn(cardClass, "p-5")}>
            <div className="flex items-center justify-between gap-3">
              <h2 className={cardTitleClass}>最近的心情</h2>
              <span className="text-[11px] text-ink-faint">
                近 30 天
              </span>
            </div>
            <p className="mt-4 text-[24px] font-medium leading-tight text-accent-deep">
              {mood.label}
            </p>
            <p className="mt-2 text-[12px] leading-5 text-ink-soft">
              {mood.detail}
            </p>
          </section>

          <section className={cn(cardClass, "p-5")}>
            <div className="flex items-center justify-between gap-3">
              <h2 className={cardTitleClass}>常出现的人</h2>
              <span className="text-[11px] text-ink-faint">
                近 90 天
              </span>
            </div>

            {topPeople.length > 0 ? (
              <ul className="mt-3 space-y-2.5">
                {topPeople.map(([name, count]) => (
                  <li key={name}>
                    <Link
                      href={`/search?q=${encodeURIComponent(name)}`}
                      className="flex items-center justify-between gap-3 text-[13px] text-ink-soft transition hover:text-ink"
                    >
                      <span className="truncate">{name}</span>
                      <span className="display-nums shrink-0 font-display text-[12px] text-ink-faint">
                        {count} 次
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-[12px] leading-5 text-ink-faint">
                还没有记下一起的人。
              </p>
            )}
          </section>

          <section className={cn(cardClass, "p-5")}>
            <div>
              <h2 className={cardTitleClass}>生活的重心</h2>
              <p className="mt-0.5 text-[11px] text-ink-faint">
                近 90 天
              </p>
            </div>
            <div className="mt-4">
              <CategoryDistribution data={categories} />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
