"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import {
  btnGhost,
  btnPrimary,
  cardClass,
  inputClass,
  textareaClass,
} from "@/lib/ui";
import { cn, formatDateTime } from "@/lib/utils";

export function QuickEvent() {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [now, setNow] = useState(() => formatDateTime(new Date()));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  async function handleSubmit(formEvent: React.FormEvent) {
    formEvent.preventDefault();

    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setError("先写一句发生了什么");
      return;
    }

    setSaving(true);
    setError(null);
    setSaved(false);

    try {
      const response = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: cleanTitle,
          description: description.trim() || cleanTitle,
          eventTime: new Date().toISOString(),
          eventPrecision: "datetime",
          category: "other",
          eventType: "occurrence",
          importance: 3,
        }),
      });

      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error ?? "记录失败");
      }

      setTitle("");
      setDescription("");
      setSaved(true);
      setNow(formatDateTime(new Date()));
      router.refresh();

      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setSaved(false), 2200);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "记录失败",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={cn(cardClass, "p-5")}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold text-ink">
            记下此刻
          </h2>
          <p className="mt-1 text-[12px] text-ink-faint">
            先写下来，时间会自动记上。
          </p>
        </div>
        <Link href="/events/new" className={btnGhost}>
          多写一点
        </Link>
      </div>

      <form
        onSubmit={(event) => void handleSubmit(event)}
        className="mt-4 space-y-3"
      >
        <div className="flex items-center gap-2 text-[12px] text-ink-soft">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
          <span className="text-[12.5px]" suppressHydrationWarning>
            现在 · {now}
          </span>
        </div>

        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="刚刚发生了什么？"
          className={cn(inputClass, "h-11 text-[15px]")}
        />

        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={2}
          placeholder="想多记两句就写在这里，可留空。"
          className={textareaClass}
        />

        <div className="flex items-center justify-between gap-3">
          <span className="text-[11px] text-ink-faint">
            {saved
              ? "已经记下了"
              : "先写下来，心情和后来怎样可以以后再补。"}
          </span>
          <button
            type="submit"
            disabled={saving}
            className={btnPrimary}
          >
            {saving ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Plus size={14} />
            )}
            记下来
          </button>
        </div>

        {error ? (
          <p className="text-[12px] text-danger">{error}</p>
        ) : null}
      </form>
    </section>
  );
}
