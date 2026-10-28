import type { Metadata } from "next";
import { ChatView } from "@/components/chat-view";
import { getLlmSetupStatus } from "@/lib/ai/config";
import { countEligibleEntries } from "@/lib/modules/entries/service";

export const metadata: Metadata = { title: "新对话" };
export const dynamic = "force-dynamic";

export default function NewAssistantPage() {
  const llm = getLlmSetupStatus();

  return (
    <ChatView
      initialMessages={[]}
      providerConfigured={llm.configured}
      initialContextCount={countEligibleEntries()}
    />
  );
}
