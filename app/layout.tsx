import type { Metadata } from "next";
import "./globals.css";
import { MobileHeader } from "@/components/mobile-header";
import { MobileNav } from "@/components/mobile-nav";
import { Sidebar } from "@/components/sidebar";

export const metadata: Metadata = {
  title: {
    default: "个人生活助手",
    template: "%s · 个人生活助手",
  },
  description: "本地优先的个人生活记录与回顾助手。",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" className="h-full">
      <body className="min-h-full bg-canvas text-ink antialiased">
        <div className="min-h-screen lg:flex">
          <Sidebar />
          <main className="min-h-screen min-w-0 flex-1 pb-20 lg:pb-0">
            <MobileHeader />
            <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-10 lg:py-9">
              {children}
            </div>
          </main>
        </div>
        <MobileNav />
      </body>
    </html>
  );
}
