import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AppMark } from "@/components/app-mark";
import { btnSecondary } from "@/lib/ui";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md py-20 text-center">
      <AppMark className="mx-auto h-10 w-10 text-accent" />
      <h1 className="mt-4 text-[18px] font-semibold text-ink">
        页面不存在
      </h1>
      <p className="mt-1.5 text-[13px] text-ink-soft">
        这个页面可能已被删除，或者链接不正确。
      </p>
      <Link
        href="/"
        className={`${btnSecondary} mt-5`}
      >
        <ArrowLeft size={14} />
        回到今天
      </Link>
    </div>
  );
}
