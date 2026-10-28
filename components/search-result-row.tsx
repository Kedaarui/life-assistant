import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { SearchHit } from "@/lib/modules/search/service";
import { formatEntryPeriod } from "@/lib/time-precision";
import { splitEntry } from "@/lib/utils";
import { CategoryBadge, EventTypeBadge } from "./event-badges";
import { HighlightText } from "./highlight-text";

function sourceLabel(source: SearchHit["matchedBy"][number]) {
  return source === "semantic" ? "语义" : "关键词";
}

export function SearchResultRow({
  hit,
  query,
}: {
  hit: SearchHit;
  query: string;
}) {
  const { heading } = splitEntry(
    hit.entry.title,
    hit.entry.contentMd,
  );
  const sources = [
    ...new Set(hit.matchedBy.map((source) => sourceLabel(source))),
  ];

  return (
    <Link
      href={`/events/${hit.entry.id}`}
      className="group block border-b border-line px-4 py-4 transition last:border-0 hover:bg-surface-soft"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="display-nums font-display text-[12px] text-ink-faint">
              {formatEntryPeriod(
                hit.entry.eventTime,
                hit.entry.eventPrecision,
                hit.entry.timeNote,
              )}
            </span>
            <CategoryBadge category={hit.entry.category} />
            <EventTypeBadge eventType={hit.entry.eventType} />
            {sources.map((source) => (
              <span
                key={source}
                className="rounded-full border border-line bg-surface-soft px-2 py-0.5 text-[11px] text-ink-faint"
              >
                {source}
              </span>
            ))}
          </div>

          <h2 className="mt-1.5 text-[14px] font-medium leading-6 text-ink">
            <HighlightText text={heading} query={query} />
          </h2>

          {hit.snippet ? (
            <p className="mt-1 line-clamp-2 text-[12px] leading-5 text-ink-soft">
              <HighlightText text={hit.snippet} query={query} />
            </p>
          ) : null}

          {hit.entry.people.length > 0 || hit.entry.tags.length > 0 ? (
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-ink-faint">
              {hit.entry.people.slice(0, 3).map((person) => (
                <span key={person.id}>@{person.name}</span>
              ))}
              {hit.entry.tags.slice(0, 3).map((tag) => (
                <span key={tag.id}>#{tag.name}</span>
              ))}
            </div>
          ) : null}
        </div>

        <ChevronRight
          size={15}
          className="mt-1 shrink-0 text-ink-faint transition group-hover:text-ink-soft"
        />
      </div>
    </Link>
  );
}
