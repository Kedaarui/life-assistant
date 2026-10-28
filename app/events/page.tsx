import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Search, X } from "lucide-react";
import { EventRow } from "@/components/event-row";
import { PageHeader } from "@/components/page-header";
import {
  EVENT_CATEGORIES,
  EVENT_TYPES,
  IMPORTANCE_LEVELS,
  isEventCategory,
  isEventType,
} from "@/lib/event-meta";
import {
  listEntries,
  type EntryWithTags,
} from "@/lib/modules/entries/service";
import {
  btnPrimary,
  cardClass,
  inputClass,
  selectClass,
} from "@/lib/ui";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "记录" };
export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  q?: string;
  tag?: string;
  category?: string;
  eventType?: string;
  importance?: string;
  year?: string;
}>;

export default async function EventsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const tag = typeof params.tag === "string" ? params.tag.trim() : "";
  const category = isEventCategory(params.category)
    ? params.category
    : undefined;
  const eventType = isEventType(params.eventType)
    ? params.eventType
    : undefined;
  const rawYear =
    typeof params.year === "string" ? params.year.trim() : "";
  const year = /^\d{4}$/.test(rawYear) ? Number(rawYear) : null;
  const rawImportance =
    typeof params.importance === "string"
      ? Number(params.importance)
      : NaN;
  const importanceMin =
    Number.isInteger(rawImportance) &&
    rawImportance >= 1 &&
    rawImportance <= 5
      ? rawImportance
      : undefined;

  const from = year ? new Date(year, 0, 1) : undefined;
  const to = year ? new Date(year + 1, 0, 1) : undefined;

  const events = listEntries({
    q: q || undefined,
    tag: tag || undefined,
    category,
    eventType,
    importanceMin,
    from,
    to,
    limit: 300,
    order: "desc",
  });

  const filtering = Boolean(
    q || tag || category || eventType || importanceMin || year,
  );

  return (
    <div>
      <PageHeader
        title="记录"
        description="发生过的事，按时间排好。"
        actions={
          <Link href="/events/new" className={btnPrimary}>
            <Plus size={15} />
            记一件事
          </Link>
        }
      />

      <form
        action="/events"
        className={cn(cardClass, "mt-5 p-3")}
      >
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-[minmax(0,1fr)_112px_104px_108px_88px_auto]">
          <div className="relative col-span-2 sm:col-span-1">
            <Search
              size={14}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint"
            />
            <input
              name="q"
              defaultValue={q}
              placeholder="搜索记下的事"
              className={cn(inputClass, "pl-8")}
            />
          </div>

          <select
            name="category"
            defaultValue={category ?? ""}
            className={selectClass}
            aria-label="类别"
          >
            <option value="">全部类别</option>
            {EVENT_CATEGORIES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>

          <select
            name="eventType"
            defaultValue={eventType ?? ""}
            className={selectClass}
            aria-label="类型"
          >
            <option value="">全部类型</option>
            {EVENT_TYPES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>

          <select
            name="importance"
            defaultValue={importanceMin ? String(importanceMin) : ""}
            className={selectClass}
            aria-label="最低分量"
          >
            <option value="">分量</option>
            {[...IMPORTANCE_LEVELS]
              .reverse()
              .filter((item) => item.value >= 2)
              .map((item) => (
                <option key={item.value} value={item.value}>
                  ≥ {item.label}
                </option>
              ))}
          </select>

          <input
            name="year"
            defaultValue={year ?? ""}
            inputMode="numeric"
            maxLength={4}
            placeholder="年份"
            aria-label="年份"
            className={inputClass}
          />

          <button type="submit" className={btnPrimary}>
            筛选
          </button>

          {tag ? (
            <input type="hidden" name="tag" value={tag} />
          ) : null}
        </div>

        {filtering ? (
          <div className="mt-2.5 flex flex-wrap items-center gap-2 border-t border-line pt-2.5">
            <span className="text-[11px] text-ink-faint">
              已应用筛选
            </span>
            {tag ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-line bg-surface-soft px-2 py-0.5 text-[11px] text-ink-soft">
                #{tag}
              </span>
            ) : null}
            <Link
              href="/events"
              className="inline-flex items-center gap-0.5 text-[11px] text-ink-faint underline-offset-2 hover:text-ink hover:underline"
            >
              <X size={10} />
              清除
            </Link>
          </div>
        ) : null}
      </form>

      <div className="mt-4 flex items-center justify-between">
        <p className="text-[12px] text-ink-faint">
          {filtering ? "筛选结果" : "全部记录"}，{events.length} 条
        </p>
        <p className="hidden text-[11px] text-ink-faint sm:block">
          按发生时间倒序
        </p>
      </div>

      <section className={cn(cardClass, "mt-2")}>
        <div className="hidden grid-cols-[108px_minmax(0,1fr)_76px_20px] gap-4 border-b border-line bg-surface-soft/60 px-4 py-2.5 text-[11px] font-medium text-ink-faint sm:grid">
          <span>时间</span>
          <span>事情</span>
          <span className="text-right">心情</span>
          <span />
        </div>

        {events.length > 0 ? (
          events.map((event: EntryWithTags) => (
            <EventRow key={event.id} event={event} />
          ))
        ) : (
          <div className="px-5 py-14 text-center">
            <p className="text-[14px] font-medium text-ink">
              {filtering ? "没有符合条件的记录" : "还没有记下任何事"}
            </p>
            <p className="mt-1 text-[12px] leading-5 text-ink-faint">
              {filtering
                ? "换个条件试试，或者清除筛选。"
                : "从第一件小事开始，时间会替你排好。"}
            </p>
            {!filtering ? (
              <Link
                href="/events/new"
                className={cn(btnPrimary, "mt-5")}
              >
                <Plus size={15} />
                记下一件事
              </Link>
            ) : null}
          </div>
        )}
      </section>
    </div>
  );
}
