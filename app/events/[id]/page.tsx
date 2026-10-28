import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarClock,
  Pencil,
} from "lucide-react";
import {
  CategoryBadge,
  EventTypeBadge,
  SensitivityBadge,
  SentimentBadge,
} from "@/components/event-badges";
import {
  categoryLabel,
  eventTypeLabel,
  importanceLabel,
  sensitivityLabel,
  sentimentLabel,
} from "@/lib/event-meta";
import { getEntry } from "@/lib/modules/entries/service";
import {
  followUpState,
  formatEntryPeriod,
  precisionLabel,
} from "@/lib/time-precision";
import {
  btnGhost,
  btnSecondary,
  cardClass,
  cardHeaderClass,
  cardTitleClass,
} from "@/lib/ui";
import {
  cn,
  formatTimestamp,
  splitEntry,
} from "@/lib/utils";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const event = getEntry(id);
  if (!event) return { title: "记录不存在" };
  return { title: splitEntry(event.title, event.contentMd).heading };
}

function MetaRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <dt className="shrink-0 text-[12px] text-ink-faint">{label}</dt>
      <dd className="text-right text-[12px] text-ink-soft">
        {children}
      </dd>
    </div>
  );
}

export default async function EventDetailPage({ params }: Props) {
  const { id } = await params;
  const event = getEntry(id);

  if (!event) notFound();

  const { heading, body } = splitEntry(
    event.title,
    event.contentMd,
  );
  const followUp = event.followUpAt
    ? followUpState(event.followUpAt)
    : null;

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <Link href="/events" className={btnGhost}>
          <ArrowLeft size={15} />
          记录
        </Link>
        <Link
          href={`/events/${event.id}/edit`}
          className={btnSecondary}
        >
          <Pencil size={14} />
          编辑
        </Link>
      </div>

      <header className="mt-5 border-b border-line pb-5">
        <div className="flex flex-wrap items-center gap-1.5">
          <CategoryBadge category={event.category} />
          <EventTypeBadge eventType={event.eventType} />
          <SensitivityBadge sensitivity={event.sensitivity} />
        </div>

        <h1 className="mt-3 text-[26px] font-semibold leading-tight tracking-tight text-ink">
          {heading}
        </h1>

        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12px] text-ink-soft">
          <span className="display-nums font-display text-[16px] text-accent-deep">
            {formatEntryPeriod(
              event.eventTime,
              event.eventPrecision,
              event.timeNote,
            )}
          </span>
          {event.location ? (
            <span className="text-ink-soft">{event.location}</span>
          ) : null}
          {event.sentiment ? (
            <SentimentBadge sentiment={event.sentiment} />
          ) : null}
        </div>
      </header>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-5">
          <section className={cn(cardClass, "p-5")}>
            <h2 className={cardTitleClass}>这件事</h2>
            <div className="event-content mt-3 text-[14px] text-ink">
              {body || "没有写更多细节"}
            </div>
          </section>

          {event.outcome ? (
            <section className={cn(cardClass, "p-5")}>
              <h2 className={cardTitleClass}>后来呢</h2>
              <div className="event-content mt-3 text-[14px] text-ink">
                {event.outcome}
              </div>
            </section>
          ) : null}

          {event.followUpAt && followUp ? (
            <section className={cn(cardClass, "p-5")}>
              <h2 className={cardTitleClass}>想记得</h2>
              <div className="mt-3 flex flex-wrap items-center gap-2.5 text-[12px] text-ink-soft">
                <CalendarClock
                  size={15}
                  className="text-ink-faint"
                />
                <span>
                  {formatEntryPeriod(event.followUpAt, "day")}
                </span>
                <span
                  className={cn(
                    "rounded px-1.5 py-0.5 text-[11px] font-medium",
                    followUp.tone === "overdue"
                      ? "bg-danger/10 text-danger"
                      : followUp.tone === "today"
                        ? "bg-warning/10 text-warning"
                        : "bg-surface-soft text-ink-soft",
                  )}
                >
                  {followUp.tone === "upcoming"
                    ? "还记着"
                    : followUp.label}
                </span>
              </div>
            </section>
          ) : null}
        </div>

        <aside className="space-y-5">
          <section className={cardClass}>
            <div className={cardHeaderClass}>
              <h2 className={cardTitleClass}>记录信息</h2>
            </div>
            <dl className="divide-y divide-line px-4 py-1">
              <MetaRow label="类别">
                {categoryLabel(event.category)}
              </MetaRow>
              <MetaRow label="类型">
                {eventTypeLabel(event.eventType)}
              </MetaRow>
              <MetaRow label="分量">
                {importanceLabel(event.importance)}
              </MetaRow>
              <MetaRow label="当时的心情">
                {event.sentiment
                  ? sentimentLabel(event.sentiment)
                  : "没有记下"}
              </MetaRow>
              <MetaRow label="时间精度">
                {precisionLabel(event.eventPrecision)}
              </MetaRow>
              <MetaRow label="隐私">
                {sensitivityLabel(event.sensitivity)}
              </MetaRow>
              <MetaRow label="记下于">
                {formatTimestamp(event.recordedAt)}
              </MetaRow>
              <MetaRow label="修改于">
                {formatTimestamp(event.updatedAt)}
              </MetaRow>
            </dl>
          </section>

          {event.people.length > 0 ? (
            <section className={cn(cardClass, "p-5")}>
              <h2 className={cardTitleClass}>一起的人</h2>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {event.people.map((person) => (
                  <Link
                    key={person.id}
                    href={`/search?q=${encodeURIComponent(person.name)}`}
                    className="rounded-full border border-line bg-surface-soft px-2 py-0.5 text-[11px] text-ink-soft transition hover:border-line-strong hover:text-ink"
                  >
                    @{person.name}
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          {event.tags.length > 0 ? (
            <section className={cn(cardClass, "p-5")}>
              <h2 className={cardTitleClass}>标签</h2>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {event.tags.map((tag) => (
                  <Link
                    key={tag.id}
                    href={`/events?tag=${encodeURIComponent(tag.name)}`}
                    className="rounded-full border border-line bg-surface-soft px-2 py-0.5 text-[11px] text-ink-soft transition hover:border-line-strong hover:text-ink"
                  >
                    #{tag.name}
                  </Link>
                ))}
              </div>
            </section>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
