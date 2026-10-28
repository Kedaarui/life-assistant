import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { EntryWithTags } from "@/lib/modules/entries/service";
import { eventDateParts } from "@/lib/time-precision";
import { excerpt, splitEntry } from "@/lib/utils";
import {
  CategoryBadge,
  EventTypeBadge,
  SentimentBadge,
} from "./event-badges";

export function EventRow({ event }: { event: EntryWithTags }) {
  const date = eventDateParts(event.eventTime, event.eventPrecision);
  const { heading, body } = splitEntry(event.title, event.contentMd);
  const preview = body ? excerpt(body, 90) : "";

  return (
    <Link
      href={`/events/${event.id}`}
      className="group grid grid-cols-[92px_minmax(0,1fr)] items-start gap-3 border-b border-line px-4 py-3.5 transition last:border-0 hover:bg-surface-soft sm:grid-cols-[108px_minmax(0,1fr)_76px_20px] sm:gap-4"
    >
      <div className="pt-0.5">
        <div className="display-nums font-display text-[15px] leading-tight text-ink">
          {date.primary}
        </div>
        <div className="mt-1 text-[11px] text-ink-faint">
          {date.secondary}
        </div>
      </div>

      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate text-[14px] font-medium text-ink">
            {heading}
          </span>
        </div>

        {preview ? (
          <p className="mt-0.5 line-clamp-1 text-[12.5px] leading-5 text-ink-soft">
            {preview}
          </p>
        ) : null}

        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <CategoryBadge category={event.category} />
          <EventTypeBadge eventType={event.eventType} />
          {event.people.slice(0, 2).map((person) => (
            <span
              key={person.id}
              className="text-[11px] text-ink-faint"
            >
              @{person.name}
            </span>
          ))}
          {event.tags.slice(0, 2).map((tag) => (
            <span key={tag.id} className="text-[11px] text-ink-faint">
              #{tag.name}
            </span>
          ))}
        </div>
      </div>

      <div className="hidden justify-end pt-0.5 sm:flex">
        {event.sentiment ? (
          <SentimentBadge sentiment={event.sentiment} />
        ) : null}
      </div>

      <ChevronRight
        size={15}
        className="mt-0.5 hidden self-start text-ink-faint transition group-hover:text-ink-soft sm:block"
      />
    </Link>
  );
}
