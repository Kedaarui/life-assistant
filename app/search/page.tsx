import type { Metadata } from "next";
import Link from "next/link";
import { Info, Search, X } from "lucide-react";
import { EventRow } from "@/components/event-row";
import { PageHeader } from "@/components/page-header";
import { ReindexButton } from "@/components/reindex-button";
import { SearchResultRow } from "@/components/search-result-row";
import { getEmbeddingStatus } from "@/lib/ai/embedding-config";
import {
  EVENT_CATEGORIES,
  EVENT_TYPES,
  isEventCategory,
  isEventType,
} from "@/lib/event-meta";
import {
  getYearOverview,
  listEntries,
} from "@/lib/modules/entries/service";
import { getIndexStatus } from "@/lib/modules/search/indexer";
import {
  searchEntries,
  type SearchMode,
} from "@/lib/modules/search/service";
import {
  btnPrimary,
  cardClass,
  cardHeaderClass,
  cardTitleClass,
  inputClass,
  selectClass,
} from "@/lib/ui";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "搜索" };
export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  q?: string;
  year?: string;
  category?: string;
  eventType?: string;
}>;

function buildQuery(params: {
  q?: string;
  year?: string;
  category?: string;
  eventType?: string;
}) {
  const query = new URLSearchParams();
  if (params.q) query.set("q", params.q);
  if (params.year) query.set("year", params.year);
  if (params.category) query.set("category", params.category);
  if (params.eventType) query.set("eventType", params.eventType);
  const value = query.toString();
  return value ? `/search?${value}` : "/search";
}

function modeLabel(mode: SearchMode) {
  switch (mode) {
    case "hybrid":
      return "综合查找";
    case "keyword":
      return "关键词";
    case "vector":
      return "语义";
    case "time":
      return "按时间";
    default:
      return "浏览";
  }
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const rawYear =
    typeof params.year === "string" ? params.year.trim() : "";
  const year = /^\d{4}$/.test(rawYear) ? Number(rawYear) : null;
  const category = isEventCategory(params.category)
    ? params.category
    : undefined;
  const eventType = isEventType(params.eventType)
    ? params.eventType
    : undefined;
  const filtering = Boolean(q || year || category || eventType);

  const embedding = getEmbeddingStatus();
  const indexStatus = getIndexStatus();
  const years = getYearOverview();

  const search = filtering
    ? await searchEntries({
        query: q,
        from: year ? new Date(year, 0, 1) : undefined,
        to: year ? new Date(year + 1, 0, 1) : undefined,
        timeLabel: year ? `${year} 年` : undefined,
        category,
        eventType,
        limit: 30,
      })
    : null;

  const recent = filtering
    ? []
    : listEntries({ limit: 5, order: "desc" });

  return (
    <div>
      <PageHeader
        title="搜索"
        description="找一件记过的事，或者某个年份。"
        actions={
          <Link href="/events/new" className={btnPrimary}>
            记一件事
          </Link>
        }
      />

      <form action="/search" className={cn(cardClass, "mt-5 p-3")}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-[minmax(0,1fr)_112px_104px_88px_auto]">
          <div className="relative col-span-2 sm:col-span-1">
            <Search
              size={14}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint"
            />
            <input
              name="q"
              defaultValue={q}
              placeholder="搜索记下的事，或直接问：2015 年我在做什么"
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
            搜索
          </button>
        </div>
      </form>

      {years.length > 0 ? (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <Link
            href={buildQuery({
              q,
              category,
              eventType,
            })}
            className={
              year
                ? "rounded-full border border-line bg-surface px-2.5 py-1 text-[11px] text-ink-soft transition hover:bg-surface-soft hover:text-ink"
                : "rounded-full border border-accent/30 bg-accent-soft px-2.5 py-1 text-[11px] font-medium text-accent"
            }
          >
            全部年份
          </Link>
          {years.slice(0, 10).map((item) => (
            <Link
              key={item.year}
              href={buildQuery({
                q,
                year: String(item.year),
                category,
                eventType,
              })}
              className={
                year === item.year
                  ? "rounded-full border border-accent/30 bg-accent-soft px-2.5 py-1 text-[11px] font-medium text-accent"
                  : "rounded-full border border-line bg-surface px-2.5 py-1 text-[11px] text-ink-soft transition hover:bg-surface-soft hover:text-ink"
              }
            >
              {item.year}
              <span className="ml-1 text-ink-faint">{item.count}</span>
            </Link>
          ))}
        </div>
      ) : null}

      {!embedding.configured ? (
        <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-line bg-surface px-4 py-3">
          <Info size={14} className="mt-0.5 shrink-0 text-ink-faint" />
          <p className="text-[12px] leading-5 text-ink-soft">
            智能搜索还没开启，现在按关键词和时间查找。可以在{" "}
            <Link
              href="/settings"
              className="font-medium text-accent underline-offset-2 hover:underline"
            >
              设置
            </Link>{" "}
            里开启。
          </p>
        </div>
      ) : null}

      {embedding.configured && indexStatus.stale ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warning/25 bg-warning/5 px-4 py-3">
          <p className="text-[12px] leading-5 text-warning">
            搜索数据和当前设置对不上，建议更新一下。
          </p>
          <ReindexButton />
        </div>
      ) : null}

      {embedding.configured &&
      !indexStatus.stale &&
      indexStatus.indexedEntries < indexStatus.totalEntries ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warning/25 bg-warning/5 px-4 py-3">
          <p className="text-[12px] leading-5 text-warning">
            还有 {indexStatus.totalEntries - indexStatus.indexedEntries}{" "}
            条没收录，可能找不到。
          </p>
          <ReindexButton />
        </div>
      ) : null}

      {search ? (
        <section className="mt-6">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="text-[19px] font-semibold tracking-tight text-ink">
                {search.mode === "time" && search.timeFilter
                  ? `${search.timeFilter.label}的记录`
                  : "搜索结果"}
              </h2>
              <p className="mt-1 text-[12px] text-ink-faint">
                {search.results.length} 条 · {modeLabel(search.mode)}
                {search.timeFilter && search.mode !== "time"
                  ? ` · 时间：${search.timeFilter.label}`
                  : ""}
              </p>
            </div>
            <Link
              href="/search"
              className="inline-flex items-center gap-0.5 text-[11px] text-ink-faint underline-offset-2 hover:text-ink hover:underline"
            >
              <X size={11} />
              清除
            </Link>
          </div>

          <section className={cn(cardClass, "mt-3")}>
            {search.results.length > 0 ? (
              search.results.map((hit) => (
                <SearchResultRow
                  key={hit.entry.id}
                  hit={hit}
                  query={q}
                />
              ))
            ) : (
              <div className="px-5 py-14 text-center">
                <p className="text-[14px] font-medium text-ink">
                  没有找到相关的记录
                </p>
                <p className="mt-1 text-[12px] text-ink-faint">
                  换个关键词，或者只输入年份试试。
                </p>
              </div>
            )}
          </section>
        </section>
      ) : (
        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <section className={cardClass}>
            <div className={cardHeaderClass}>
              <div>
                <h2 className={cardTitleClass}>最近记下的</h2>
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

            {recent.length > 0 ? (
              recent.map((event) => (
                <EventRow key={event.id} event={event} />
              ))
            ) : (
              <p className="px-5 py-12 text-center text-[12px] text-ink-faint">
                还没有记录
              </p>
            )}
          </section>

          <div className="space-y-5">
            <section className={cardClass}>
              <div className={cardHeaderClass}>
                <h2 className={cardTitleClass}>按年份浏览</h2>
                <span className="text-[11px] text-ink-faint">
                  {years.length} 个年份
                </span>
              </div>
              <div className="p-3">
                {years.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2">
                    {years.map((item) => (
                      <Link
                        key={item.year}
                        href={buildQuery({ year: String(item.year) })}
                        className="rounded-lg border border-line bg-surface px-3 py-2 transition hover:border-line-strong hover:bg-surface-soft"
                      >
                        <div className="display-nums font-display text-[15px] text-ink">
                          {item.year}
                        </div>
                        <div className="mt-0.5 text-[11px] text-ink-faint">
                          {item.count} 条
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="py-6 text-center text-[11px] text-ink-faint">
                    暂无年份数据
                  </p>
                )}
              </div>
            </section>

            <section className={cn(cardClass, "p-4")}>
              <div className="flex items-center justify-between gap-3">
                <h2 className={cardTitleClass}>智能搜索</h2>
                <span
                  className={cn(
                    "rounded px-1.5 py-0.5 text-[11px] font-medium",
                    !embedding.configured
                      ? "bg-surface-soft text-ink-faint"
                      : indexStatus.stale
                        ? "bg-warning/10 text-warning"
                        : "bg-success/10 text-success",
                  )}
                >
                  {!embedding.configured
                    ? "未开启"
                    : indexStatus.stale
                      ? "需更新"
                      : "已就绪"}
                </span>
              </div>
              <p className="mt-2 text-[12px] leading-5 text-ink-faint">
                {embedding.configured
                  ? `已收录 ${indexStatus.indexedEntries}/${indexStatus.totalEntries} 条，共 ${indexStatus.chunkCount} 个片段。`
                  : "还没有开启"}
              </p>
              <div className="mt-3">
                <ReindexButton />
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
