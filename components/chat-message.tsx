import Link from "next/link";
import { BookOpen } from "lucide-react";
import { splitCitationSegments, type Citation } from "@/lib/citations";
import type { MessageDTO } from "@/lib/modules/chat/service";
import { cn, formatTime } from "@/lib/utils";
import { AppMark } from "./app-mark";

export function MessageContent({
  content,
  citations,
}: {
  content: string;
  citations: Citation[];
}) {
  const byRef = new Map(citations.map((citation) => [citation.ref, citation]));

  return (
    <div className="whitespace-pre-wrap break-words">
      {splitCitationSegments(content).map((segment, index) => {
        if (segment.type === "text") {
          return <span key={index}>{segment.value}</span>;
        }

        const citation = byRef.get(segment.ref);
        if (!citation) return null;

        return (
          <Link
            key={index}
            href={`/events/${citation.entryId}`}
            title={`${citation.title} · ${citation.date}`}
            className="mx-0.5 inline-flex items-center gap-0.5 rounded-full border border-accent/25 bg-accent-soft px-1.5 py-[1px] align-[1px] text-[10px] font-medium text-accent transition hover:bg-accent/15"
          >
            <BookOpen size={9} strokeWidth={2} />
            {citation.date}
          </Link>
        );
      })}
    </div>
  );
}

export function ChatMessage({ message }: { message: MessageDTO }) {
  const isUser = message.role === "user";

  return (
    <div
      className={cn(
        "flex gap-2.5",
        isUser ? "justify-end" : "justify-start",
      )}
    >
      {!isUser ? (
        <AppMark className="mt-1 h-5 w-5 shrink-0 text-accent" />
      ) : null}

      <div
        className={cn(
          "max-w-[85%] rounded-xl px-3.5 py-2.5 text-[13.5px] leading-6",
          isUser
            ? "bg-accent text-white"
            : "border border-line bg-surface text-ink",
        )}
      >
        {isUser ? (
          <div className="whitespace-pre-wrap break-words">
            {message.content}
          </div>
        ) : (
          <MessageContent
            content={message.content}
            citations={message.citations}
          />
        )}

        <div
          className={cn(
            "mt-1 text-[10px]",
            isUser ? "text-white/70" : "text-ink-faint",
          )}
        >
          {formatTime(new Date(message.createdAt))}
        </div>
      </div>
    </div>
  );
}

export function StreamingMessage({
  content,
  citations,
}: {
  content: string;
  citations: Citation[];
}) {
  return (
    <div className="flex justify-start gap-2.5">
      <AppMark className="mt-1 h-5 w-5 shrink-0 text-accent" />

      <div className="max-w-[85%] rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[13.5px] leading-6 text-ink">
        {content ? (
          <div>
            <MessageContent content={content} citations={citations} />
            <span className="streaming-cursor" />
          </div>
        ) : (
          <span className="inline-flex items-center gap-1 py-1">
            <span className="typing-dot" />
            <span className="typing-dot" />
            <span className="typing-dot" />
          </span>
        )}
      </div>
    </div>
  );
}
