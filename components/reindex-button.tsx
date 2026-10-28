"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw } from "lucide-react";
import { btnSecondary } from "@/lib/ui";
import { cn } from "@/lib/utils";

export function ReindexButton({
  label = "更新搜索",
}: {
  label?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleReindex() {
    if (loading) return;

    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/search/reindex", {
        method: "POST",
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        total?: number;
        indexed?: number;
        failed?: number;
      };

      if (!response.ok) {
        throw new Error(data.error ?? "更新失败");
      }

      setMessage(
        `已收录 ${data.indexed ?? 0}/${data.total ?? 0} 条${
          data.failed ? `，${data.failed} 条没成功` : ""
        }`,
      );
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "更新失败",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => void handleReindex()}
        disabled={loading}
        className={cn(btnSecondary, "px-2.5 py-1.5 text-[11px]")}
      >
        {loading ? (
          <Loader2 size={12} className="animate-spin" />
        ) : (
          <RefreshCw size={12} />
        )}
        {loading ? "更新中…" : label}
      </button>

      {message ? (
        <span className="text-[11px] text-success">{message}</span>
      ) : null}
      {error ? (
        <span className="text-[11px] text-danger">{error}</span>
      ) : null}
    </div>
  );
}
