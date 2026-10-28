"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ListChecks,
  MessageSquareText,
  Search,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/", label: "今天", icon: LayoutDashboard, exact: true },
  { href: "/events", label: "记录", icon: ListChecks },
  { href: "/assistant", label: "助手", icon: MessageSquareText },
  { href: "/search", label: "搜索", icon: Search },
  { href: "/settings", label: "设置", icon: Settings },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur-md lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto flex max-w-md items-stretch">
        {ITEMS.map((item) => {
          const active = item.exact
            ? pathname === item.href
            : pathname === item.href ||
              pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] transition",
                active ? "font-medium text-accent" : "text-ink-faint",
              )}
            >
              <Icon size={19} strokeWidth={active ? 2 : 1.7} />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
