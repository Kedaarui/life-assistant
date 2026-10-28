"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ListChecks,
  MessageSquareText,
  Plus,
  Search,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AppMark } from "./app-mark";

const NAV_GROUPS = [
  {
    label: "记录",
    items: [
      { href: "/", label: "今天", icon: LayoutDashboard, exact: true },
      { href: "/events", label: "记录", icon: ListChecks },
    ],
  },
  {
    label: "回顾",
    items: [
      { href: "/assistant", label: "助手", icon: MessageSquareText },
      { href: "/search", label: "搜索", icon: Search },
    ],
  },
  {
    label: "偏好",
    items: [{ href: "/settings", label: "设置", icon: Settings }],
  },
];

function isActive(pathname: string, href: string, exact = false) {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 hidden h-screen w-[232px] shrink-0 flex-col overflow-y-auto border-r border-line bg-sidebar px-3 py-5 lg:flex">
      <Link href="/" className="flex items-center gap-2.5 px-2">
        <AppMark className="h-8 w-8 text-accent" />
        <span>
          <span className="block text-[14px] font-semibold leading-tight text-ink">
            个人生活助手
          </span>
          <span className="mt-1 flex items-center gap-1 text-[10px] text-ink-faint">
            <span className="h-1 w-1 rounded-full bg-success" />
            数据都在本机
          </span>
        </span>
      </Link>

      <Link
        href="/events/new"
        className="mt-6 flex items-center justify-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-[13px] font-medium text-white transition hover:bg-accent-deep"
      >
        <Plus size={14} />
        记一件事
      </Link>

      <nav className="mt-6 space-y-5">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="px-3 text-[11px] text-ink-faint">{group.label}</p>
            <div className="mt-1.5 space-y-0.5">
              {group.items.map((item) => {
                const active = isActive(
                  pathname,
                  item.href,
                  item.exact,
                );
                const Icon = item.icon;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "group flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] transition",
                      active
                        ? "bg-accent-soft font-medium text-accent"
                        : "text-ink-soft hover:bg-surface-soft hover:text-ink",
                    )}
                  >
                    <Icon
                      size={16}
                      strokeWidth={active ? 2 : 1.8}
                      className={
                        active
                          ? "text-accent"
                          : "text-ink-faint group-hover:text-ink-soft"
                      }
                    />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="mt-auto border-t border-line px-3 pt-4">
        <div className="flex items-center gap-2 text-[11px] text-ink-soft">
          <span className="h-1.5 w-1.5 rounded-full bg-success" />
          本地运行
        </div>
        <p className="mt-1 text-[10px] text-ink-faint">
          记录、回看与助手
        </p>
      </div>
    </aside>
  );
}
