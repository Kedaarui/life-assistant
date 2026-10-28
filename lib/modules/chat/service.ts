import { asc, desc, eq } from "drizzle-orm";
import { db, sqlite } from "@/lib/db";
import { conversations, messages } from "@/lib/db/schema";
import type { ChatMode } from "@/lib/chat-modes";
import { stripCitationMarkers, type Citation } from "@/lib/citations";
import { excerpt } from "@/lib/utils";

export type ConversationRow = typeof conversations.$inferSelect;
export type MessageRow = typeof messages.$inferSelect;

export type MessageDTO = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  citations: Citation[];
  model: string | null;
  createdAt: string;
};

export type ConversationSummary = {
  id: string;
  title: string | null;
  mode: string;
  updatedAt: Date;
  messageCount: number;
  lastMessage: string | null;
};

export function createConversation(
  mode: ChatMode,
  title: string,
): ConversationRow {
  const now = new Date();
  const row: ConversationRow = {
    id: crypto.randomUUID(),
    title,
    mode,
    createdAt: now,
    updatedAt: now,
  };

  db.insert(conversations).values(row).run();
  return row;
}

export function getConversation(id: string): ConversationRow | null {
  return (
    db
      .select()
      .from(conversations)
      .where(eq(conversations.id, id))
      .get() ?? null
  );
}

export function getMessages(conversationId: string): MessageRow[] {
  return db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(asc(messages.createdAt))
    .all();
}

export function getRecentMessages(
  conversationId: string,
  limit = 12,
): MessageRow[] {
  const rows = db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(desc(messages.createdAt))
    .limit(limit)
    .all();

  return rows.reverse();
}

export function addMessage(input: {
  conversationId: string;
  role: "user" | "assistant" | "system";
  content: string;
  citations?: Citation[];
  model?: string | null;
  id?: string;
}): MessageRow {
  const id = input.id ?? crypto.randomUUID();
  const now = new Date();

  db.transaction((tx) => {
    tx.insert(messages)
      .values({
        id,
        conversationId: input.conversationId,
        role: input.role,
        content: input.content,
        citations: input.citations?.length
          ? JSON.stringify(input.citations)
          : null,
        model: input.model ?? null,
        createdAt: now,
      })
      .run();

    tx.update(conversations)
      .set({ updatedAt: now })
      .where(eq(conversations.id, input.conversationId))
      .run();
  });

  const row = db
    .select()
    .from(messages)
    .where(eq(messages.id, id))
    .get();

  if (!row) throw new Error("Message was not persisted");
  return row;
}

export function touchConversation(id: string, title?: string) {
  db.update(conversations)
    .set({
      updatedAt: new Date(),
      ...(title ? { title } : {}),
    })
    .where(eq(conversations.id, id))
    .run();
}

function parseCitations(value: string | null): Citation[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as Citation[]) : [];
  } catch {
    return [];
  }
}

export function serializeMessage(row: MessageRow): MessageDTO {
  return {
    id: row.id,
    role:
      row.role === "assistant"
        ? "assistant"
        : row.role === "system"
          ? "system"
          : "user",
    content: row.content,
    citations: parseCitations(row.citations),
    model: row.model,
    createdAt: row.createdAt.toISOString(),
  };
}

export function listConversations(): ConversationSummary[] {
  const rows = sqlite
    .prepare(
      `SELECT
         c.id AS id,
         c.title AS title,
         c.mode AS mode,
         c.updated_at AS updated_at,
         (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id) AS message_count,
         (SELECT m.content FROM messages m
          WHERE m.conversation_id = c.id
          ORDER BY m.created_at DESC, m.rowid DESC LIMIT 1) AS last_message
       FROM conversations c
       ORDER BY c.updated_at DESC
       LIMIT 50`,
    )
    .all() as {
    id: string;
    title: string | null;
    mode: string;
    updated_at: number;
    message_count: number;
    last_message: string | null;
  }[];

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    mode: row.mode,
    updatedAt: new Date(row.updated_at),
    messageCount: row.message_count,
    lastMessage: row.last_message
      ? excerpt(stripCitationMarkers(row.last_message), 90)
      : null,
  }));
}

export function titleFromMessage(message: string) {
  const first = message
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);

  if (!first) return "新对话";
  const cleaned = stripCitationMarkers(first);
  return cleaned.length > 28 ? `${cleaned.slice(0, 28)}…` : cleaned;
}

