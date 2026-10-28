"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowUp,
  Loader2,
  MessageSquarePlus,
  Square,
} from "lucide-react";
import type { ChatMode } from "@/lib/chat-modes";
import { CHAT_MODES, chatModeLabel } from "@/lib/chat-modes";
import type { Citation } from "@/lib/citations";
import type { MessageDTO } from "@/lib/modules/chat/service";
import { btnPrimary, btnSecondary } from "@/lib/ui";
import { cn } from "@/lib/utils";
import { AppMark } from "./app-mark";
import { ChatMessage, StreamingMessage } from "./chat-message";

const SUGGESTIONS = [
  "最近一个月，我都在忙些什么？",
  "帮我看看最近的心情变化",
  "最近常见的人有哪些？",
  "2019 年我做了哪些重要决定？",
];

type RetrievalMode = "hybrid" | "keyword" | "vector" | "time" | "browse";

type ChatViewProps = {
  conversation?: {
    id: string;
    title: string | null;
    mode: ChatMode;
  };
  initialMessages: MessageDTO[];
  providerConfigured: boolean;
  initialContextCount: number;
};

export function ChatView({
  conversation,
  initialMessages,
  providerConfigured,
  initialContextCount,
}: ChatViewProps) {
  const [messages, setMessages] = useState<MessageDTO[]>(initialMessages);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [streamingCitations, setStreamingCitations] = useState<Citation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(
    conversation?.id ?? null,
  );
  const [title, setTitle] = useState<string | null>(
    conversation?.title ?? null,
  );
  const [mode, setMode] = useState<ChatMode>(conversation?.mode ?? "companion");
  const [contextCount, setContextCount] = useState(initialContextCount);
  const [retrievalMode, setRetrievalMode] =
    useState<RetrievalMode | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const assistantTextRef = useRef("");
  const assistantIdRef = useRef<string | null>(null);
  const streamingCitationsRef = useRef<Citation[]>([]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages, streamingText]);

  function handleStop() {
    abortRef.current?.abort();
  }

  async function handleSend(rawInput?: string) {
    const content = (rawInput ?? input).trim();
    if (!content || sending) return;

    if (!providerConfigured) {
      setError("还没有配置模型，请先在设置中完成配置。");
      return;
    }

    setInput("");
    setError(null);
    setSending(true);
    setStreamingText("");
    setStreamingCitations([]);
    assistantTextRef.current = "";
    streamingCitationsRef.current = [];
    assistantIdRef.current = null;

    const optimisticUserId = `local-user-${Date.now()}`;
    const optimisticUser: MessageDTO = {
      id: optimisticUserId,
      role: "user",
      content,
      citations: [],
      model: null,
      createdAt: new Date().toISOString(),
    };
    setMessages((previous) => [...previous, optimisticUser]);

    const controller = new AbortController();
    abortRef.current = controller;

    let metaReceived = false;
    let finished = false;

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, message: content, mode }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(data.error ?? "请求失败，请稍后再试");
      }

      if (!response.body) {
        throw new Error("没有收到响应流");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let streamError: string | null = null;

      const handleEvent = (event: string, data: unknown) => {
        if (event === "meta") {
          const meta = data as {
            conversationId: string;
            conversationTitle: string | null;
            userMessageId: string;
            assistantMessageId: string;
            contextEntries: number;
            retrievalMode: RetrievalMode;
            citations: Citation[];
          };

          metaReceived = true;
          setConversationId(meta.conversationId);
          setTitle(meta.conversationTitle);
          setContextCount(meta.contextEntries);
          setRetrievalMode(meta.retrievalMode);
          setStreamingCitations(meta.citations);
          streamingCitationsRef.current = meta.citations;
          assistantIdRef.current = meta.assistantMessageId;

          setMessages((previous) =>
            previous.map((message) =>
              message.id === optimisticUserId
                ? { ...message, id: meta.userMessageId }
                : message,
            ),
          );

          if (typeof window !== "undefined") {
            window.history.replaceState(
              null,
              "",
              `/assistant/${meta.conversationId}`,
            );
          }
          return;
        }

        if (event === "delta") {
          const delta = data as { text: string };
          assistantTextRef.current += delta.text;
          setStreamingText(assistantTextRef.current);
          return;
        }

        if (event === "done") {
          const done = data as {
            message: MessageDTO | null;
            conversationTitle: string | null;
            contextEntries: number;
            retrievalMode: RetrievalMode;
          };

          if (!done.message) {
            streamError = "模型没有返回内容，请重试。";
            return;
          }

          const message = done.message;
          finished = true;
          setMessages((previous) => [...previous, message]);
          setStreamingText("");
          setStreamingCitations([]);
          streamingCitationsRef.current = [];
          setTitle(done.conversationTitle);
          setContextCount(done.contextEntries);
          setRetrievalMode(done.retrievalMode);
          return;
        }

        if (event === "error") {
          streamError = (data as { message: string }).message;
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split("\n\n");
        buffer = chunks.pop() ?? "";

        for (const chunk of chunks) {
          let eventName = "message";
          let dataLine = "";

          for (const line of chunk.split(/\r?\n/)) {
            if (line.startsWith("event:")) {
              eventName = line.slice(6).trim();
            } else if (line.startsWith("data:")) {
              dataLine += line.slice(5).trim();
            }
          }

          if (!dataLine) continue;
          try {
            handleEvent(eventName, JSON.parse(dataLine));
          } catch {
            // Ignore malformed events and keep consuming the stream.
          }
        }
      }

      if (streamError && !finished) {
        throw new Error(streamError);
      }
      if (!finished) {
        throw new Error("连接意外中断，请重试");
      }
    } catch (caught) {
      const aborted = controller.signal.aborted;
      const partial = assistantTextRef.current.trim();

      if (!finished && partial) {
        const partialMessage: MessageDTO = {
          id: assistantIdRef.current ?? `local-assistant-${Date.now()}`,
          role: "assistant",
          content: assistantTextRef.current,
          citations: streamingCitationsRef.current,
          model: null,
          createdAt: new Date().toISOString(),
        };
        setMessages((previous) => [...previous, partialMessage]);
      }

      if (!metaReceived) {
        setMessages((previous) =>
          previous.filter((message) => message.id !== optimisticUserId),
        );
        setInput((current) => current || content);
      }

      if (!aborted && !finished) {
        setError(
          caught instanceof Error ? caught.message : "对话失败，请稍后再试",
        );
      }

      setStreamingText("");
      setStreamingCitations([]);
      streamingCitationsRef.current = [];
    } finally {
      setSending(false);
      abortRef.current = null;
      assistantIdRef.current = null;
      textareaRef.current?.focus();
    }
  }

  const contextLabel =
    contextCount === 0
      ? "还没有记录"
      : retrievalMode === "time"
        ? `参考了 ${contextCount} 条那段时间的记录`
        : retrievalMode
          ? `参考了 ${contextCount} 条相关记录`
          : `已记下 ${contextCount} 条`;

  return (
    <div className="flex h-[calc(100dvh-11rem)] flex-col lg:h-[calc(100dvh-4rem)]">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-line pb-3">
        <div className="flex min-w-0 items-center gap-2">
          <Link
            href="/assistant"
            className="rounded-lg p-1.5 text-ink-faint transition hover:bg-surface-soft hover:text-ink"
            aria-label="返回助手列表"
          >
            <ArrowLeft size={16} />
          </Link>
          <div className="min-w-0">
            <h1 className="truncate text-[16px] font-semibold text-ink">
              {title || "新对话"}
            </h1>
            <p className="mt-0.5 text-[11px] text-ink-faint">
              {chatModeLabel(mode)}，{contextLabel}
            </p>
          </div>
        </div>

        <Link
          href="/assistant/new"
          className={cn(btnSecondary, "px-2.5 py-1.5 text-[11px]")}
        >
          <MessageSquarePlus size={13} />
          新对话
        </Link>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto py-5">
        {messages.length === 0 && !sending ? (
          <div className="flex h-full flex-col items-center justify-center px-3 text-center">
            <AppMark className="h-10 w-10 text-accent" />
            <h2 className="mt-4 text-[20px] font-semibold text-ink">
              从一件具体的事聊起
            </h2>
            <p className="mt-1.5 max-w-md text-[12.5px] leading-6 text-ink-soft">
              助手会翻看你记下的事，再一起看看、聊聊。
            </p>
            <div className="mt-6 grid w-full max-w-lg gap-2 sm:grid-cols-2">
              {SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => {
                    setInput(suggestion);
                    textareaRef.current?.focus();
                  }}
                  className="rounded-xl border border-line bg-surface px-3 py-2.5 text-left text-[12.5px] leading-5 text-ink-soft transition hover:border-line-strong hover:bg-surface-soft hover:text-ink"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message) => (
              <ChatMessage key={message.id} message={message} />
            ))}
            {sending ? (
              <StreamingMessage
                content={streamingText}
                citations={streamingCitations}
              />
            ) : null}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-line pt-3">
        {!providerConfigured ? (
          <div className="mb-2.5 rounded-lg border border-warning/25 bg-warning/5 px-3 py-2 text-[12px] leading-5 text-warning">
            还没有配置模型。请在{" "}
            <Link href="/settings" className="font-medium underline underline-offset-2">
              设置
            </Link>{" "}
            中填写 API Key，或先用{" "}
            <code className="rounded bg-surface px-1 py-0.5 text-[11px]">
              npm run mock:llm
            </code>{" "}
            在本地试跑。
          </div>
        ) : null}

        {error ? (
          <div className="mb-2.5 rounded-lg border border-danger/25 bg-danger/5 px-3 py-2 text-[12px] text-danger">
            {error}
          </div>
        ) : null}

        {!conversationId ? (
          <div className="mb-2.5 flex flex-wrap gap-1.5">
            {CHAT_MODES.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setMode(item.value)}
                className={cn(
                  "rounded-full border px-2.5 py-1.5 text-[11px] transition",
                  mode === item.value
                    ? "border-accent/40 bg-accent-soft font-medium text-accent"
                    : "border-line bg-surface text-ink-soft hover:bg-surface-soft hover:text-ink",
                )}
              >
                {item.label}
                <span className="ml-1 text-[10px] text-ink-faint">
                  {item.hint}
                </span>
              </button>
            ))}
          </div>
        ) : null}

        <div className="rounded-xl border border-line bg-surface p-2 transition focus-within:border-accent/50">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                !event.shiftKey &&
                !event.nativeEvent.isComposing
              ) {
                event.preventDefault();
                void handleSend();
              }
            }}
            rows={2}
            disabled={!providerConfigured || sending}
            placeholder={
              providerConfigured
                ? "想聊点什么？比如：最近一个月我都在忙什么"
                : "配置模型后就可以开始聊了"
            }
            className="max-h-40 w-full resize-none bg-transparent px-2 py-1.5 text-[13.5px] leading-6 text-ink placeholder:text-ink-faint focus:outline-none disabled:opacity-60"
          />

          <div className="flex items-center justify-between gap-2 px-2 pb-1">
            <span className="text-[11px] leading-4 text-ink-faint">
              Enter 发送，Shift + Enter 换行。「只在本机」的记录不会发送
            </span>

            <div className="flex items-center gap-1.5">
              {sending ? (
                <button
                  type="button"
                  onClick={handleStop}
                  className={cn(
                    btnSecondary,
                    "px-2.5 py-1.5 text-[11px]",
                  )}
                >
                  <Square size={10} />
                  停止
                </button>
              ) : null}

              <button
                type="button"
                onClick={() => void handleSend()}
                disabled={!input.trim() || sending || !providerConfigured}
                className={cn(btnPrimary, "px-3 py-1.5 text-[12px]")}
              >
                {sending ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <ArrowUp size={13} />
                )}
                发送
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
