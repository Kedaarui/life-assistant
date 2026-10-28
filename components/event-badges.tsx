import {
  categoryLabel,
  eventTypeLabel,
  importanceLabel,
  sentimentLabel,
  sensitivityLabel,
  type EventCategory,
  type EventType,
} from "@/lib/event-meta";
import { cn } from "@/lib/utils";

const CATEGORY_STYLES: Record<EventCategory, string> = {
  work: "border-[#c9a888]/50 bg-[#f3e9df] text-[#7a5b3e]",
  health: "border-[#a9b79c]/60 bg-[#edf1e7] text-[#4f6b4a]",
  relationship: "border-[#d8b3b8]/60 bg-[#f7e9eb] text-[#8a4a55]",
  learning: "border-[#b8b4cc]/60 bg-[#eeedf5] text-[#5b547a]",
  finance: "border-[#d6be93]/60 bg-[#f6efdf] text-[#8a6428]",
  life: "border-[#d3c7b8]/70 bg-[#f3eee7] text-[#6e6154]",
  other: "border-[#e0d6c8]/80 bg-[#f7f2eb] text-[#8a7c6c]",
};

const IMPORTANCE_DOTS: Record<number, string> = {
  1: "bg-[#c9bcac]",
  2: "bg-[#b08a6a]",
  3: "bg-accent",
  4: "bg-warning",
  5: "bg-danger",
};

const SENTIMENT_STYLES: Record<number, string> = {
  1: "bg-danger/10 text-danger",
  2: "bg-warning/10 text-warning",
  3: "bg-surface-soft text-ink-soft",
  4: "bg-success/10 text-success",
  5: "bg-accent-soft text-accent-deep",
};

export function CategoryBadge({ category }: { category: EventCategory }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded border px-1.5 py-0.5 text-[11px] font-medium",
        CATEGORY_STYLES[category],
      )}
    >
      {categoryLabel(category)}
    </span>
  );
}

export function EventTypeBadge({ eventType }: { eventType: EventType }) {
  return (
    <span className="inline-flex items-center rounded border border-line bg-surface-soft px-1.5 py-0.5 text-[11px] font-medium text-ink-soft">
      {eventTypeLabel(eventType)}
    </span>
  );
}

export function SentimentBadge({ sentiment }: { sentiment: number }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
        SENTIMENT_STYLES[sentiment] ?? SENTIMENT_STYLES[3],
      )}
    >
      {sentimentLabel(sentiment)}
    </span>
  );
}

export function ImportanceDot({ value }: { value: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1"
      title={`分量：${importanceLabel(value)}`}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          IMPORTANCE_DOTS[value] ?? "bg-[#c9bcac]",
        )}
      />
      <span className="text-[11px] text-ink-faint">
        {importanceLabel(value)}
      </span>
    </span>
  );
}

export function SensitivityBadge({
  sensitivity,
}: {
  sensitivity: string;
}) {
  if (sensitivity === "normal") return null;

  return (
    <span className="inline-flex items-center rounded border border-line bg-surface-soft px-1.5 py-0.5 text-[11px] text-ink-soft">
      {sensitivityLabel(sensitivity)}
    </span>
  );
}
