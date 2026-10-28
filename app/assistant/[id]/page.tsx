import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ChatView } from "@/components/chat-view";
import { getLlmSetupStatus } from "@/lib/ai/config";
import { isChatMode } from "@/lib/chat-modes";
import {
  getConversation,
  getMessages,
  serializeMessage,
  titleFromMessage,
} from "@/lib/modules/chat/service";
import { countEligibleEntries } from "@/lib/modules/entries/service";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const conversation = getConversation(id);
  if (!conversation) return { title: "对话不存在" };
  return { title: conversation.title ?? "对话" };
}

export default async function AssistantDetailPage({ params }: Props) {
  const { id } = await params;
  const conversation = getConversation(id);

  if (!conversation) notFound();

  const messages = getMessages(id).map(serializeMessage);
  const firstUser = messages.find((message) => message.role === "user");
  const title =
    conversation.title ??
    (firstUser ? titleFromMessage(firstUser.content) : "新对话");
  const mode = isChatMode(conversation.mode)
    ? conversation.mode
    : "companion";

  return (
    <ChatView
      conversation={{ id: conversation.id, title, mode }}
      initialMessages={messages}
      providerConfigured={getLlmSetupStatus().configured}
      initialContextCount={countEligibleEntries()}
    />
  );
}
