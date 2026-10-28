import type { Metadata } from "next";
import Link from "next/link";
import {
  ChevronRight,
  MessageSquarePlus,
  MessagesSquare,
  Settings2,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { getLlmSetupStatus } from "@/lib/ai/config";
import { chatModeLabel } from "@/lib/chat-modes";
import { listConversations } from "@/lib/modules/chat/service";
import {
  btnPrimary,
  cardClass,
} from "@/lib/ui";
import { formatTimestamp } from "@/lib/utils";

export const metadata: Metadata = { title: "助手" };
export const dynamic = "force-dynamic";

export default function AssistantPage() {
  const conversations = listConversations();
  const llm = getLlmSetupStatus();

  return (
    <div>
      <PageHeader
        title="助手"
        description="基于你记录的事，一起聊聊、看看。"
        actions={
          <Link href="/assistant/new" className={btnPrimary}>
            <MessageSquarePlus size={15} />
            新建对话
          </Link>
        }
      />

      {!llm.configured ? (
        <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-warning/25 bg-warning/5 px-4 py-3">
          <Settings2 size={15} className="mt-0.5 shrink-0 text-warning" />
          <div>
            <p className="text-[12px] font-medium text-warning">
              尚未配置模型
            </p>
            <p className="mt-0.5 text-[12px] leading-5 text-ink-soft">
              在{" "}
              <Link
                href="/settings"
                className="font-medium underline underline-offset-2"
              >
                设置
              </Link>{" "}
              中填写 API Key 后即可使用助手。
            </p>
          </div>
        </div>
      ) : null}

      {conversations.length === 0 ? (
        <div className={`${cardClass} mt-5 px-5 py-16 text-center`}>
          <MessagesSquare
            size={24}
            className="mx-auto text-ink-faint"
          />
          <p className="mt-3 text-[14px] font-medium text-ink">
            还没有聊过
          </p>
          <p className="mt-1 text-[12px] leading-5 text-ink-faint">
            从一个具体的问题开始，让助手陪你一起看看。
          </p>
          <Link
            href="/assistant/new"
            className={`${btnPrimary} mt-5`}
          >
            <MessageSquarePlus size={15} />
            聊一聊
          </Link>
        </div>
      ) : (
        <section className={`${cardClass} mt-5`}>
          <div className="divide-y divide-line">
            {conversations.map((conversation) => (
              <Link
                key={conversation.id}
                href={`/assistant/${conversation.id}`}
                className="group flex items-start justify-between gap-4 px-4 py-4 transition hover:bg-surface-soft"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate text-[14px] font-medium text-ink">
                      {conversation.title || "未命名对话"}
                    </h2>
                    <span className="rounded-full border border-line bg-surface-soft px-2 py-0.5 text-[11px] text-ink-soft">
                      {chatModeLabel(conversation.mode)}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-1 text-[12.5px] text-ink-soft">
                    {conversation.lastMessage ?? "还没有消息"}
                  </p>
                  <div className="mt-1.5 text-[11px] text-ink-faint">
                    {conversation.messageCount} 条消息，{" "}
                    {formatTimestamp(conversation.updatedAt)}
                  </div>
                </div>

                <ChevronRight
                  size={15}
                  className="mt-1 shrink-0 text-ink-faint transition group-hover:text-ink-soft"
                />
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
