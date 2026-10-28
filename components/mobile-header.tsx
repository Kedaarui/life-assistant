import Link from "next/link";
import { Plus } from "lucide-react";
import { AppMark } from "./app-mark";

export function MobileHeader() {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-canvas/90 px-4 py-3 backdrop-blur-md lg:hidden">
      <Link href="/" className="flex items-center gap-2">
        <AppMark className="h-6 w-6 text-accent" />
        <span className="text-[13px] font-semibold text-ink">
          个人生活助手
        </span>
      </Link>
      <Link
        href="/events/new"
        className="inline-flex items-center gap-1 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[12px] font-medium text-ink-soft transition hover:bg-surface-soft hover:text-ink"
      >
        <Plus size={13} />
        记一件
      </Link>
    </header>
  );
}
