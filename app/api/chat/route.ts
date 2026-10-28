import { z } from "zod";
import { getLlmConfig } from "@/lib/ai/config";
import { LlmRequestError, streamCompletion } from "@/lib/ai/stream";
import { isChatMode, type ChatMode } from "@/lib/chat-modes";
import { extractCitations } from "@/lib/citations";
import { buildChatPrompt } from "@/lib/modules/chat/context";
import {
  addMessage,
  createConversation,
  getConversation,
  serializeMessage,
  titleFromMessage,
  touchConversation,
} from "@/lib/modules/chat/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const bodySchema = z.object({
  conversationId: z.string().min(1).optional(),
  message: z.string().trim().min(1, "消息不能为空").max(4000),
  mode: z.enum(["companion", "advice", "brainstorm", "review"]).optional(),
});

function friendlyError(error: unknown) {
  if (error instanceof LlmRequestError) {
    if (error.status === 401 || error.status === 403) {
      return "模型认证失败，请检查 API Key 是否正确。";
    }
    if (error.status === 404) {
      return "模型接口不存在，请检查 Base URL 和模型名。";
    }
    if (error.status === 429) {
      return "模型服务限流或余额不足，请稍后再试。";
    }
    return `模型调用失败（${error.status}），请稍后再试。`;
  }

  if (error instanceof Error && error.message === "模型没有返回内容") {
    return "模型没有返回内容，请重试。";
  }

  return "对话失败，请稍后再试。";
}

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "请求体不是合法的 JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) {
    return Response.json(
      { error: "参数校验失败", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const config = getLlmConfig();
  if (!config) {
    return Response.json(
      {
        error:
          "还没有配置模型。请在项目根目录的 .env.local 中设置 LLM_API_KEY，然后重启服务。",
        code: "LLM_NOT_CONFIGURED",
      },
      { status: 400 },
    );
  }

  let conversation = parsed.data.conversationId
    ? getConversation(parsed.data.conversationId)
    : null;

  if (parsed.data.conversationId && !conversation) {
    return Response.json({ error: "对话不存在" }, { status: 404 });
  }

  const mode: ChatMode = conversation
    ? isChatMode(conversation.mode)
      ? conversation.mode
      : "companion"
    : (parsed.data.mode ?? "companion");

  if (!conversation) {
    conversation = createConversation(
      mode,
      titleFromMessage(parsed.data.message),
    );
  } else if (!conversation.title?.trim()) {
    const title = titleFromMessage(parsed.data.message);
    touchConversation(conversation.id, title);
    conversation = { ...conversation, title };
  }

  const conversationId = conversation.id;
  const conversationTitle = conversation.title;

  const userMessage = addMessage({
    conversationId,
    role: "user",
    content: parsed.data.message,
  });

  const prompt = await buildChatPrompt({
    conversationId,
    currentMessageId: userMessage.id,
    currentMessage: parsed.data.message,
    mode,
  });

  const assistantId = crypto.randomUUID();
  const model = config.model;
  const encoder = new TextEncoder();

  const send = (event: string, data: unknown) =>
    encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      let text = "";
      let saved = false;

      const persistAssistant = () => {
        if (saved) return null;
        saved = true;
        if (!text.trim()) return null;

        const citations = extractCitations(text, prompt.citations);
        const row = addMessage({
          id: assistantId,
          conversationId,
          role: "assistant",
          content: text,
          citations,
          model,
        });

        return serializeMessage(row);
      };

      try {
        controller.enqueue(
          send("meta", {
            conversationId,
            conversationTitle,
            userMessageId: userMessage.id,
            assistantMessageId: assistantId,
            contextEntries: prompt.entryCount,
            retrievalMode: prompt.retrievalMode,
            model,
            citations: prompt.citations,
          }),
        );

        for await (const delta of streamCompletion(prompt.messages, {
          signal: request.signal,
        })) {
          text += delta;
          controller.enqueue(send("delta", { text: delta }));
        }

        if (!text.trim()) {
          throw new Error("模型没有返回内容");
        }

        const message = persistAssistant();
        controller.enqueue(
          send("done", {
            message,
            conversationTitle,
            contextEntries: prompt.entryCount,
            retrievalMode: prompt.retrievalMode,
          }),
        );
      } catch (error) {
        if (!request.signal.aborted) {
          console.error("[chat] stream failed", error);
        }

        if (text.trim()) persistAssistant();

        if (!request.signal.aborted) {
          try {
            controller.enqueue(
              send("error", { message: friendlyError(error) }),
            );
          } catch {
            // The client may have disconnected between the check and enqueue.
          }
        }
      } finally {
        try {
          controller.close();
        } catch {
          // Already closed by a disconnected client.
        }
      }
    },
  });

  return new Response(body, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
