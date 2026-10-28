"use client";

import { useEffect } from "react";
import { RefreshCw } from "lucide-react";
import { btnPrimary } from "@/lib/ui";
import { cn } from "@/lib/utils";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-md py-20 text-center">
      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-surface text-sm font-semibold text-ink-faint">
        !
      </div>
      <h1 className="mt-4 text-[18px] font-semibold text-ink">
        页面加载失败
      </h1>
      <p className="mt-1.5 text-[13px] leading-6 text-ink-soft">
        {error.message || "请稍后重试。"}
      </p>
      <button
        type="button"
        onClick={reset}
        className={cn(btnPrimary, "mt-5")}
      >
        <RefreshCw size={14} />
        重试
      </button>
    </div>
  );
}
