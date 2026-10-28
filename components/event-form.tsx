"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ArrowLeft,
  ChevronDown,
  Clock,
  Loader2,
  Trash2,
} from "lucide-react";
import {
  EVENT_CATEGORIES,
  EVENT_TYPES,
  IMPORTANCE_LEVELS,
  SENSITIVITY_OPTIONS,
  SENTIMENT_LEVELS,
  type EventCategory,
  type EventType,
} from "@/lib/event-meta";
import type { EventDTO } from "@/lib/modules/entries/service";
import {
  TIME_PRECISIONS,
  parsePrecisionInput,
  toPrecisionInputValue,
  type TimePrecision,
} from "@/lib/time-precision";
import {
  btnDanger,
  btnGhost,
  btnPrimary,
  cardClass,
  inputClass,
  selectClass,
  textareaClass,
} from "@/lib/ui";
import { cn } from "@/lib/utils";

function splitList(value: string) {
  return value
    .split(/[,，、\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function EventForm({
  event,
  defaultEventTime,
}: {
  event?: EventDTO;
  defaultEventTime: string;
}) {
  const router = useRouter();

  const [title, setTitle] = useState(event?.title ?? "");
  const [description, setDescription] = useState(event?.description ?? "");
  const [outcome, setOutcome] = useState(event?.outcome ?? "");
  const [category, setCategory] = useState<EventCategory>(
    event?.category ?? "other",
  );
  const [eventType, setEventType] = useState<EventType>(
    event?.eventType ?? "occurrence",
  );
  const [importance, setImportance] = useState(event?.importance ?? 3);
  const [sentiment, setSentiment] = useState<number | null>(
    event?.sentiment ?? null,
  );
  const [precision, setPrecision] = useState<TimePrecision>(
    event?.eventPrecision ?? "datetime",
  );
  const [eventInput, setEventInput] = useState(() =>
    toPrecisionInputValue(
      new Date(event?.eventTime ?? defaultEventTime),
      event?.eventPrecision ?? "datetime",
    ),
  );
  const [timeNote, setTimeNote] = useState(event?.timeNote ?? "");
  const [location, setLocation] = useState(event?.location ?? "");
  const [followUpInput, setFollowUpInput] = useState(
    event?.followUpAt
      ? toPrecisionInputValue(new Date(event.followUpAt), "day")
      : "",
  );
  const [people, setPeople] = useState(
    event?.people.map((person) => person.name).join(", ") ?? "",
  );
  const [tags, setTags] = useState(
    event?.tags.map((tag) => tag.name).join(", ") ?? "",
  );
  const [sensitivity, setSensitivity] = useState<
    "normal" | "private" | "local_only"
  >(event?.sensitivity ?? "normal");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasAdvanced = Boolean(
    event &&
      (event.eventType !== "occurrence" ||
        event.importance !== 3 ||
        event.sentiment !== null ||
        event.outcome ||
        event.people.length > 0 ||
        event.tags.length > 0 ||
        event.location ||
        event.followUpAt ||
        event.sensitivity !== "normal"),
  );

  function handlePrecisionChange(next: TimePrecision) {
    if (next === precision) return;

    const parsed = parsePrecisionInput(eventInput, precision);
    const base = parsed ?? new Date(event?.eventTime ?? defaultEventTime);

    setPrecision(next);
    setEventInput(toPrecisionInputValue(base, next));
  }

  async function handleSave() {
    const cleanTitle = title.trim();
    const cleanDescription = description.trim() || cleanTitle;

    if (!cleanTitle) {
      setError("写一句发生了什么再保存");
      return;
    }

    const parsedEventTime = parsePrecisionInput(eventInput, precision);
    if (!parsedEventTime) {
      setError(
        precision === "year"
          ? "请输入四位年份，例如 2015"
          : "发生时间格式不正确",
      );
      return;
    }

    const followUpAt = followUpInput
      ? new Date(`${followUpInput}T00:00:00`)
      : null;

    if (followUpAt && Number.isNaN(followUpAt.getTime())) {
      setError("想再想起的日期格式不正确");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await fetch(
        event ? `/api/events/${event.id}` : "/api/events",
        {
          method: event ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: cleanTitle,
            description: cleanDescription,
            eventTime: parsedEventTime.toISOString(),
            eventPrecision: precision,
            timeNote: timeNote.trim() || null,
            sentiment,
            category,
            eventType,
            importance,
            outcome: outcome.trim() || null,
            followUpAt: followUpAt ? followUpAt.toISOString() : null,
            location: location.trim() || null,
            sensitivity,
            tags: splitList(tags),
            people: splitList(people),
          }),
        },
      );

      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        event?: { id: string };
      };

      if (!response.ok) {
        throw new Error(data.error ?? "保存失败，请稍后再试");
      }

      const id = event?.id ?? data.event?.id;
      router.push(id ? `/events/${id}` : "/events");
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "保存失败",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!event || deleting) return;
    if (
      !window.confirm(
        "确定删除这条记录吗？删除后不会出现在列表与搜索中。",
      )
    ) {
      return;
    }

    setDeleting(true);
    setError(null);

    try {
      const response = await fetch(`/api/events/${event.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(data.error ?? "删除失败");
      }

      router.push("/events");
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "删除失败",
      );
      setDeleting(false);
    }
  }

  return (
    <form
      onSubmit={(formEvent) => {
        formEvent.preventDefault();
        void handleSave();
      }}
      className="mx-auto max-w-2xl"
    >
      <div>
        <Link
          href={event ? `/events/${event.id}` : "/events"}
          className={btnGhost}
        >
          <ArrowLeft size={15} />
          返回
        </Link>
      </div>

      <div className="mt-6">
        <h1 className="text-[26px] font-semibold leading-tight tracking-tight text-ink">
          {event ? "修改这件事" : "记下一件事"}
        </h1>
        <p className="mt-1.5 text-[13px] leading-6 text-ink-soft">
          时间和发生了什么就够了，其他可以以后慢慢补。
        </p>
      </div>

      {error ? (
        <div className="mt-4 rounded-lg border border-danger/25 bg-danger/5 px-4 py-2.5 text-[13px] text-danger">
          {error}
        </div>
      ) : null}

      <div className="mt-5 rounded-xl border border-accent/15 bg-accent-soft/50 p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <label className="flex items-center gap-1.5 text-[12px] font-medium text-accent-deep">
            <Clock size={13} strokeWidth={1.9} />
            什么时候发生的
          </label>
          <span className="text-[11px] text-ink-faint">
            记不清就只写到年或月
          </span>
        </div>

        <div className="mt-2.5">
          {precision === "datetime" ? (
            <input
              type="datetime-local"
              value={eventInput}
              onChange={(changeEvent) =>
                setEventInput(changeEvent.target.value)
              }
              className={cn(
                inputClass,
                "display-nums h-12 border-accent/20 bg-surface/90 font-display text-[18px]",
              )}
            />
          ) : precision === "day" ? (
            <input
              type="date"
              value={eventInput}
              onChange={(changeEvent) =>
                setEventInput(changeEvent.target.value)
              }
              className={cn(
                inputClass,
                "display-nums h-12 border-accent/20 bg-surface/90 font-display text-[18px]",
              )}
            />
          ) : precision === "month" ? (
            <input
              type="month"
              value={eventInput}
              onChange={(changeEvent) =>
                setEventInput(changeEvent.target.value)
              }
              className={cn(
                inputClass,
                "display-nums h-12 border-accent/20 bg-surface/90 font-display text-[18px]",
              )}
            />
          ) : (
            <input
              type="text"
              inputMode="numeric"
              maxLength={4}
              value={eventInput}
              onChange={(changeEvent) =>
                setEventInput(changeEvent.target.value)
              }
              placeholder="例如 2015"
              className={cn(
                inputClass,
                "display-nums h-12 border-accent/20 bg-surface/90 font-display text-[18px]",
              )}
            />
          )}
        </div>

        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {TIME_PRECISIONS.map((item) => (
            <button
              key={item.value}
              type="button"
              title={item.hint}
              onClick={() => handlePrecisionChange(item.value)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-[11px] transition",
                precision === item.value
                  ? "border-accent/35 bg-surface font-medium text-accent"
                  : "border-accent/15 text-ink-soft hover:bg-surface/60 hover:text-ink",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className={cn(cardClass, "mt-4 space-y-5 p-5")}>
        <div>
          <label
            htmlFor="event-title"
            className="mb-1.5 block text-[12px] font-medium text-ink-soft"
          >
            发生了什么
          </label>
          <input
            id="event-title"
            value={title}
            onChange={(changeEvent) => setTitle(changeEvent.target.value)}
            className={cn(inputClass, "h-11 text-[15px]")}
          />
        </div>

        <div>
          <label
            htmlFor="event-description"
            className="mb-1.5 block text-[12px] font-medium text-ink-soft"
          >
            细节
          </label>
          <textarea
            id="event-description"
            value={description}
            onChange={(changeEvent) =>
              setDescription(changeEvent.target.value)
            }
            rows={5}
            placeholder="想多记两句就写在这里，可留空。"
            className={textareaClass}
          />
        </div>

        <div>
          <label
            htmlFor="event-category"
            className="mb-1.5 block text-[12px] font-medium text-ink-soft"
          >
            归到哪一类
          </label>
          <select
            id="event-category"
            value={category}
            onChange={(changeEvent) =>
              setCategory(changeEvent.target.value as EventCategory)
            }
            className={selectClass}
          >
            {EVENT_CATEGORIES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>

        <details
          open={hasAdvanced}
          className="group border-t border-line pt-4"
        >
          <summary className="flex cursor-pointer list-none items-center justify-between text-[12px] font-medium text-ink-soft">
            更多细节（可选）
            <ChevronDown
              size={14}
              className="text-ink-faint transition group-open:rotate-180"
            />
          </summary>

          <div className="mt-4 space-y-4">
            <div>
              <label className="mb-1.5 block text-[12px] font-medium text-ink-soft">
                这件事更像
              </label>
              <select
                value={eventType}
                onChange={(changeEvent) =>
                  setEventType(changeEvent.target.value as EventType)
                }
                className={selectClass}
              >
                {EVENT_TYPES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-[12px] font-medium text-ink-soft">
                对我的分量
              </label>
              <select
                value={importance}
                onChange={(changeEvent) =>
                  setImportance(Number(changeEvent.target.value))
                }
                className={selectClass}
              >
                {IMPORTANCE_LEVELS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-[12px] font-medium text-ink-soft">
                当时的心情
              </label>
              <select
                value={sentiment ?? ""}
                onChange={(changeEvent) =>
                  setSentiment(
                    changeEvent.target.value
                      ? Number(changeEvent.target.value)
                      : null,
                  )
                }
                className={selectClass}
              >
                <option value="">未设置</option>
                {SENTIMENT_LEVELS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-[12px] font-medium text-ink-soft">
                后来呢
              </label>
              <textarea
                value={outcome}
                onChange={(changeEvent) =>
                  setOutcome(changeEvent.target.value)
                }
                rows={3}
                placeholder="后来怎么样了？"
                className={textareaClass}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-[12px] font-medium text-ink-soft">
                和谁有关
              </label>
              <input
                value={people}
                onChange={(changeEvent) =>
                  setPeople(changeEvent.target.value)
                }
                placeholder="名字之间用逗号分开，例如：妈妈、小林"
                className={inputClass}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-[12px] font-medium text-ink-soft">
                标签
              </label>
              <input
                value={tags}
                onChange={(changeEvent) =>
                  setTags(changeEvent.target.value)
                }
                placeholder="用逗号或空格分隔"
                className={inputClass}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-[12px] font-medium text-ink-soft">
                在哪里
              </label>
              <input
                value={location}
                onChange={(changeEvent) =>
                  setLocation(changeEvent.target.value)
                }
                placeholder="可选"
                className={inputClass}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-[12px] font-medium text-ink-soft">
                时间的补充
              </label>
              <input
                value={timeNote}
                onChange={(changeEvent) =>
                  setTimeNote(changeEvent.target.value)
                }
                maxLength={40}
                placeholder="例如：夏天、毕业后"
                className={inputClass}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-[12px] font-medium text-ink-soft">
                哪天想再想起
              </label>
              <input
                type="date"
                value={followUpInput}
                onChange={(changeEvent) =>
                  setFollowUpInput(changeEvent.target.value)
                }
                className={inputClass}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-[12px] font-medium text-ink-soft">
                隐私
              </label>
              <select
                value={sensitivity}
                onChange={(changeEvent) =>
                  setSensitivity(
                    changeEvent.target.value as
                      | "normal"
                      | "private"
                      | "local_only",
                  )
                }
                className={selectClass}
              >
                {SENSITIVITY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </details>
      </div>

      <div className="mt-4 flex items-center justify-between">
        {event ? (
          <button
            type="button"
            onClick={() => void handleDelete()}
            disabled={deleting}
            className={btnDanger}
          >
            <Trash2 size={14} />
            {deleting ? "删除中…" : "删除这件事"}
          </button>
        ) : (
          <span />
        )}

        <button type="submit" disabled={saving} className={btnPrimary}>
          {saving ? (
            <Loader2 size={14} className="animate-spin" />
          ) : null}
          {event ? "保存修改" : "记下来"}
        </button>
      </div>
    </form>
  );
}
