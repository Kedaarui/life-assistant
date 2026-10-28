import { sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

const createdAt = () =>
  integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date());

const updatedAt = () =>
  integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date());

export const entries = sqliteTable(
  "entries",
  {
    id: text("id").primaryKey(),
    /** When the event happened. May be backdated by the user. */
    eventTime: integer("event_time", { mode: "timestamp_ms" }).notNull(),
    /** Exclusive end of a coarse time period (year/month/day). */
    eventTimeEnd: integer("event_time_end", { mode: "timestamp_ms" }),
    /** How precisely the user knows when this happened. */
    eventPrecision: text("event_precision", {
      enum: ["datetime", "day", "month", "year"],
    })
      .notNull()
      .default("datetime"),
    /** Free-form note such as "夏天" or "大学毕业那年". */
    timeNote: text("time_note"),
    /** When the record was actually written. */
    recordedAt: integer("recorded_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: updatedAt(),
    title: text("title"),
    contentMd: text("content_md").notNull(),
    sentiment: integer("mood"),
    energy: integer("energy"),
    category: text("category", {
      enum: [
        "work",
        "health",
        "relationship",
        "learning",
        "finance",
        "life",
        "other",
      ],
    })
      .notNull()
      .default("other"),
    eventType: text("event_type", {
      enum: ["occurrence", "decision", "milestone", "issue", "meeting"],
    })
      .notNull()
      .default("occurrence"),
    importance: integer("importance").notNull().default(3),
    outcome: text("outcome"),
    followUpAt: integer("follow_up_at", { mode: "timestamp_ms" }),
    location: text("location"),
    sensitivity: text("sensitivity", {
      enum: ["normal", "private", "local_only"],
    })
      .notNull()
      .default("normal"),
    source: text("source").notNull().default("text"),
    status: text("status").notNull().default("active"),
    deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    index("idx_entries_event_time").on(table.eventTime),
    index("idx_entries_deleted").on(table.deletedAt),
    index("idx_entries_category").on(table.category),
    index("idx_entries_event_type").on(table.eventType),
    index("idx_entries_importance").on(table.importance),
    index("idx_entries_follow_up").on(table.followUpAt),
  ],
);

export const tags = sqliteTable(
  "tags",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    category: text("category"),
    createdAt: createdAt(),
  },
  (table) => [uniqueIndex("idx_tags_name").on(table.name)],
);

export const entryTags = sqliteTable(
  "entry_tags",
  {
    entryId: text("entry_id")
      .notNull()
      .references(() => entries.id, { onDelete: "cascade" }),
    tagId: text("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.entryId, table.tagId] }),
    index("idx_entry_tags_tag").on(table.tagId),
  ],
);

export const people = sqliteTable("people", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  aliases: text("aliases"),
  relation: text("relation"),
  notes: text("notes"),
  createdAt: createdAt(),
});

export const entryPeople = sqliteTable(
  "entry_people",
  {
    entryId: text("entry_id")
      .notNull()
      .references(() => entries.id, { onDelete: "cascade" }),
    personId: text("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
    role: text("role"),
  },
  (table) => [primaryKey({ columns: [table.entryId, table.personId] })],
);

export const attachments = sqliteTable("attachments", {
  id: text("id").primaryKey(),
  entryId: text("entry_id")
    .notNull()
    .references(() => entries.id, { onDelete: "cascade" }),
  path: text("path").notNull(),
  mime: text("mime"),
  size: integer("size"),
  transcript: text("transcript"),
  createdAt: createdAt(),
});

export const chunks = sqliteTable(
  "chunks",
  {
    id: text("id").primaryKey(),
    entryId: text("entry_id")
      .notNull()
      .references(() => entries.id, { onDelete: "cascade" }),
    seq: integer("seq").notNull(),
    text: text("text").notNull(),
    tokens: integer("tokens"),
    createdAt: createdAt(),
  },
  (table) => [index("idx_chunks_entry").on(table.entryId)],
);

export const memories = sqliteTable("memories", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  subject: text("subject"),
  predicate: text("predicate"),
  object: text("object"),
  confidence: real("confidence").notNull().default(0.5),
  validFrom: integer("valid_from", { mode: "timestamp_ms" }),
  validTo: integer("valid_to", { mode: "timestamp_ms" }),
  /** JSON array of entry ids that support this memory. */
  sourceEntryIds: text("source_entry_ids").notNull().default(sql`'[]'`),
  supersededBy: text("superseded_by"),
  status: text("status").notNull().default("candidate"),
  createdAt: createdAt(),
});

export const profileSnapshots = sqliteTable("profile_snapshots", {
  id: text("id").primaryKey(),
  periodStart: integer("period_start", { mode: "timestamp_ms" }),
  periodEnd: integer("period_end", { mode: "timestamp_ms" }),
  summaryMd: text("summary_md").notNull(),
  version: integer("version").notNull().default(1),
  createdAt: createdAt(),
});

export const summaries = sqliteTable("summaries", {
  id: text("id").primaryKey(),
  granularity: text("granularity").notNull(),
  periodStart: integer("period_start", { mode: "timestamp_ms" }).notNull(),
  periodEnd: integer("period_end", { mode: "timestamp_ms" }).notNull(),
  contentMd: text("content_md").notNull(),
  /** JSON array of source ids. */
  sourceIds: text("source_ids").notNull().default(sql`'[]'`),
  createdAt: createdAt(),
});

export const goals = sqliteTable("goals", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").notNull().default("active"),
  startDate: integer("start_date", { mode: "timestamp_ms" }),
  targetDate: integer("target_date", { mode: "timestamp_ms" }),
  progress: real("progress").notNull().default(0),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const decisions = sqliteTable("decisions", {
  id: text("id").primaryKey(),
  entryId: text("entry_id").references(() => entries.id, {
    onDelete: "set null",
  }),
  question: text("question").notNull(),
  /** JSON array of options. */
  options: text("options"),
  choice: text("choice"),
  rationale: text("rationale"),
  expectedOutcome: text("expected_outcome"),
  reviewDate: integer("review_date", { mode: "timestamp_ms" }),
  actualOutcome: text("actual_outcome"),
  status: text("status").notNull().default("open"),
  createdAt: createdAt(),
});

export const conversations = sqliteTable("conversations", {
  id: text("id").primaryKey(),
  title: text("title"),
  mode: text("mode").notNull().default("companion"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const messages = sqliteTable(
  "messages",
  {
    id: text("id").primaryKey(),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    content: text("content").notNull(),
    /** JSON array of citations. */
    citations: text("citations"),
    model: text("model"),
    tokensIn: integer("tokens_in"),
    tokensOut: integer("tokens_out"),
    createdAt: createdAt(),
  },
  (table) => [index("idx_messages_conversation").on(table.conversationId)],
);

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: updatedAt(),
});

export const jobs = sqliteTable("jobs", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  status: text("status").notNull().default("pending"),
  payload: text("payload"),
  runAt: integer("run_at", { mode: "timestamp_ms" }),
  attempts: integer("attempts").notNull().default(0),
  lastError: text("last_error"),
  createdAt: createdAt(),
});
