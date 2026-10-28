import {
  and,
  asc,
  desc,
  eq,
  gt,
  gte,
  inArray,
  isNotNull,
  isNull,
  like,
  lt,
  lte,
  or,
  type SQL,
} from "drizzle-orm";
import { db, sqlite } from "@/lib/db";
import {
  entries,
  entryPeople,
  entryTags,
  people,
  tags,
} from "@/lib/db/schema";
import type { EventCategory, EventType } from "@/lib/event-meta";
import {
  normalizeEventPeriod,
  type TimePrecision,
} from "@/lib/time-precision";
import { addDays, dayKey } from "@/lib/utils";

export type EntryRow = typeof entries.$inferSelect;
export type TagSummary = { id: string; name: string };
export type PersonSummary = { id: string; name: string };
export type EntryWithTags = EntryRow & {
  tags: TagSummary[];
  people: PersonSummary[];
};

export type EntryDTO = {
  id: string;
  eventTime: string;
  eventTimeEnd: string | null;
  eventPrecision: TimePrecision;
  timeNote: string | null;
  recordedAt: string;
  updatedAt: string;
  title: string | null;
  description: string;
  sentiment: number | null;
  category: EventCategory;
  eventType: EventType;
  importance: number;
  outcome: string | null;
  followUpAt: string | null;
  location: string | null;
  sensitivity: "normal" | "private" | "local_only";
  status: string;
  tags: TagSummary[];
  people: PersonSummary[];
};

export type EventDTO = EntryDTO;
export type EventWithTags = EntryWithTags;

export type CreateEntryInput = {
  title?: string | null;
  description: string;
  eventTime?: Date;
  eventTimeEnd?: Date | null;
  eventPrecision?: TimePrecision;
  timeNote?: string | null;
  sentiment?: number | null;
  category?: EventCategory;
  eventType?: EventType;
  importance?: number;
  outcome?: string | null;
  followUpAt?: Date | null;
  location?: string | null;
  sensitivity?: "normal" | "private" | "local_only";
  tags?: string[];
  people?: string[];
};

export type UpdateEntryInput = {
  title?: string | null;
  description?: string;
  eventTime?: Date;
  eventTimeEnd?: Date | null;
  eventPrecision?: TimePrecision;
  timeNote?: string | null;
  sentiment?: number | null;
  category?: EventCategory;
  eventType?: EventType;
  importance?: number;
  outcome?: string | null;
  followUpAt?: Date | null;
  location?: string | null;
  sensitivity?: "normal" | "private" | "local_only";
  tags?: string[];
  people?: string[];
};

export type ListEntriesOptions = {
  from?: Date;
  to?: Date;
  q?: string;
  tag?: string;
  person?: string;
  category?: EventCategory;
  eventType?: EventType;
  importanceMin?: number;
  precisions?: TimePrecision[];
  limit?: number;
  order?: "asc" | "desc";
};

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export function serializeEntry(entry: EntryWithTags): EntryDTO {
  return {
    id: entry.id,
    eventTime: entry.eventTime.toISOString(),
    eventTimeEnd: entry.eventTimeEnd?.toISOString() ?? null,
    eventPrecision: entry.eventPrecision,
    timeNote: entry.timeNote,
    recordedAt: entry.recordedAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
    title: entry.title,
    description: entry.contentMd,
    sentiment: entry.sentiment,
    category: entry.category,
    eventType: entry.eventType,
    importance: entry.importance,
    outcome: entry.outcome,
    followUpAt: entry.followUpAt?.toISOString() ?? null,
    location: entry.location,
    sensitivity: entry.sensitivity,
    status: entry.status,
    tags: entry.tags,
    people: entry.people,
  };
}

function attachRelations(rows: EntryRow[]): EntryWithTags[] {
  if (rows.length === 0) return [];

  const ids = rows.map((row) => row.id);

  const tagRows = db
    .select({
      entryId: entryTags.entryId,
      id: tags.id,
      name: tags.name,
    })
    .from(entryTags)
    .innerJoin(tags, eq(tags.id, entryTags.tagId))
    .where(inArray(entryTags.entryId, ids))
    .all();

  const peopleRows = db
    .select({
      entryId: entryPeople.entryId,
      id: people.id,
      name: people.name,
    })
    .from(entryPeople)
    .innerJoin(people, eq(people.id, entryPeople.personId))
    .where(inArray(entryPeople.entryId, ids))
    .all();

  const tagsByEntry = new Map<string, TagSummary[]>();
  for (const row of tagRows) {
    const list = tagsByEntry.get(row.entryId) ?? [];
    list.push({ id: row.id, name: row.name });
    tagsByEntry.set(row.entryId, list);
  }

  const peopleByEntry = new Map<string, PersonSummary[]>();
  for (const row of peopleRows) {
    const list = peopleByEntry.get(row.entryId) ?? [];
    list.push({ id: row.id, name: row.name });
    peopleByEntry.set(row.entryId, list);
  }

  return rows.map((row) => ({
    ...row,
    tags: tagsByEntry.get(row.id) ?? [],
    people: peopleByEntry.get(row.id) ?? [],
  }));
}

export function listEntries(options: ListEntriesOptions = {}): EntryWithTags[] {
  const conditions: SQL[] = [isNull(entries.deletedAt)];

  if (options.from) {
    // Overlap semantics: a year-only event belongs to every month in that year.
    conditions.push(
      or(
        and(
          isNotNull(entries.eventTimeEnd),
          gt(entries.eventTimeEnd, options.from),
        ),
        and(
          isNull(entries.eventTimeEnd),
          gte(entries.eventTime, options.from),
        ),
      )!,
    );
  }
  if (options.to) {
    conditions.push(lt(entries.eventTime, options.to));
  }
  if (options.precisions && options.precisions.length > 0) {
    conditions.push(inArray(entries.eventPrecision, options.precisions));
  }
  if (options.category) {
    conditions.push(eq(entries.category, options.category));
  }
  if (options.eventType) {
    conditions.push(eq(entries.eventType, options.eventType));
  }
  if (options.importanceMin) {
    conditions.push(gte(entries.importance, options.importanceMin));
  }
  if (options.q) {
    const term = `%${options.q}%`;
    conditions.push(
      or(
        like(entries.title, term),
        like(entries.contentMd, term),
        like(entries.outcome, term),
      )!,
    );
  }
  if (options.tag) {
    const matchingIds = db
      .select({ entryId: entryTags.entryId })
      .from(entryTags)
      .innerJoin(tags, eq(tags.id, entryTags.tagId))
      .where(eq(tags.name, options.tag));
    conditions.push(inArray(entries.id, matchingIds));
  }
  if (options.person) {
    const matchingIds = db
      .select({ entryId: entryPeople.entryId })
      .from(entryPeople)
      .innerJoin(people, eq(people.id, entryPeople.personId))
      .where(eq(people.name, options.person));
    conditions.push(inArray(entries.id, matchingIds));
  }

  const limit = Math.min(Math.max(options.limit ?? 100, 1), 500);
  const rows = db
    .select()
    .from(entries)
    .where(and(...conditions))
    .orderBy(
      options.order === "asc"
        ? asc(entries.eventTime)
        : desc(entries.eventTime),
    )
    .limit(limit)
    .all();

  return attachRelations(rows);
}

export function getEntry(id: string): EntryWithTags | null {
  const row = db
    .select()
    .from(entries)
    .where(and(eq(entries.id, id), isNull(entries.deletedAt)))
    .get();

  if (!row) return null;

  return attachRelations([row])[0] ?? null;
}

function normalizeTags(names: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const raw of names) {
    const name = raw.replace(/^#+/, "").trim().slice(0, 24);
    if (!name) continue;
    const key = name.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(name);
    if (result.length >= 12) break;
  }

  return result;
}

function normalizePeople(names: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const raw of names) {
    const name = raw.replace(/^@+/, "").trim().slice(0, 40);
    if (!name) continue;
    const key = name.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(name);
    if (result.length >= 12) break;
  }

  return result;
}

function syncTags(tx: Transaction, entryId: string, names: string[]) {
  for (const name of names) {
    let tag = tx
      .select({ id: tags.id })
      .from(tags)
      .where(eq(tags.name, name))
      .get();

    if (!tag) {
      const id = crypto.randomUUID();
      tx.insert(tags)
        .values({ id, name, createdAt: new Date() })
        .run();
      tag = { id };
    }

    tx.insert(entryTags)
      .values({ entryId, tagId: tag.id })
      .onConflictDoNothing()
      .run();
  }
}

function syncPeople(tx: Transaction, entryId: string, names: string[]) {
  for (const name of names) {
    let person = tx
      .select({ id: people.id })
      .from(people)
      .where(eq(people.name, name))
      .get();

    if (!person) {
      const id = crypto.randomUUID();
      tx.insert(people)
        .values({ id, name, createdAt: new Date() })
        .run();
      person = { id };
    }

    tx.insert(entryPeople)
      .values({ entryId, personId: person.id })
      .onConflictDoNothing()
      .run();
  }
}

export function createEntry(input: CreateEntryInput): EntryWithTags {
  const id = crypto.randomUUID();
  const now = new Date();
  const precision = input.eventPrecision ?? "datetime";
  const period = normalizeEventPeriod(input.eventTime ?? now, precision);

  db.transaction((tx) => {
    tx.insert(entries)
      .values({
        id,
        eventTime: period.eventTime,
        eventTimeEnd:
          precision === "datetime"
            ? (input.eventTimeEnd ?? null)
            : period.eventTimeEnd,
        eventPrecision: precision,
        timeNote: input.timeNote?.trim() || null,
        recordedAt: now,
        updatedAt: now,
        title: input.title?.trim() || null,
        contentMd: input.description,
        sentiment: input.sentiment ?? null,
        category: input.category ?? "other",
        eventType: input.eventType ?? "occurrence",
        importance: input.importance ?? 3,
        outcome: input.outcome?.trim() || null,
        followUpAt: input.followUpAt ?? null,
        location: input.location?.trim() || null,
        sensitivity: input.sensitivity ?? "normal",
        source: "text",
        status: "active",
      })
      .run();

    syncTags(tx, id, normalizeTags(input.tags ?? []));
    syncPeople(tx, id, normalizePeople(input.people ?? []));
  });

  const created = getEntry(id);
  if (!created) throw new Error("Entry was not persisted");
  return created;
}

export function updateEntry(
  id: string,
  patch: UpdateEntryInput,
): EntryWithTags | null {
  const existing = getEntry(id);
  if (!existing) return null;

  const nextPrecision = patch.eventPrecision ?? existing.eventPrecision;
  const nextEventTime = patch.eventTime ?? existing.eventTime;
  const period = normalizeEventPeriod(nextEventTime, nextPrecision);
  const nextEventTimeEnd =
    nextPrecision === "datetime"
      ? (patch.eventTimeEnd !== undefined
          ? patch.eventTimeEnd
          : existing.eventTimeEnd)
      : period.eventTimeEnd;

  db.transaction((tx) => {
    tx.update(entries)
      .set({
        ...(patch.description !== undefined
          ? { contentMd: patch.description }
          : {}),
        ...(patch.title !== undefined
          ? { title: patch.title?.trim() || null }
          : {}),
        eventTime: period.eventTime,
        eventTimeEnd: nextEventTimeEnd,
        eventPrecision: nextPrecision,
        ...(patch.timeNote !== undefined
          ? { timeNote: patch.timeNote?.trim() || null }
          : {}),
        ...(patch.sentiment !== undefined
          ? { sentiment: patch.sentiment }
          : {}),
        ...(patch.category !== undefined
          ? { category: patch.category }
          : {}),
        ...(patch.eventType !== undefined
          ? { eventType: patch.eventType }
          : {}),
        ...(patch.importance !== undefined
          ? { importance: patch.importance }
          : {}),
        ...(patch.outcome !== undefined
          ? { outcome: patch.outcome?.trim() || null }
          : {}),
        ...(patch.followUpAt !== undefined
          ? { followUpAt: patch.followUpAt }
          : {}),
        ...(patch.location !== undefined
          ? { location: patch.location?.trim() || null }
          : {}),
        ...(patch.sensitivity !== undefined
          ? { sensitivity: patch.sensitivity }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(entries.id, id))
      .run();

    if (patch.tags !== undefined) {
      tx.delete(entryTags).where(eq(entryTags.entryId, id)).run();
      syncTags(tx, id, normalizeTags(patch.tags));
    }

    if (patch.people !== undefined) {
      tx.delete(entryPeople).where(eq(entryPeople.entryId, id)).run();
      syncPeople(tx, id, normalizePeople(patch.people));
    }
  });

  return getEntry(id);
}

export function deleteEntry(id: string) {
  const result = db
    .update(entries)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(entries.id, id), isNull(entries.deletedAt)))
    .run();

  return result.changes > 0;
}

export type Stats = {
  total: number;
  characters: number;
  thisMonth: number;
  streak: number;
  last7Days: number;
  pendingFollowUps: number;
  highImportance: number;
};

export function getStats(): Stats {
  const totalRow = sqlite
    .prepare(
      `SELECT COUNT(*) AS count, COALESCE(SUM(LENGTH(content_md)), 0) AS chars
       FROM entries WHERE deleted_at IS NULL`,
    )
    .get() as { count: number; chars: number };

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const sevenDaysAgo = addDays(now, -7);

  const monthRow = sqlite
    .prepare(
      `SELECT COUNT(*) AS count FROM entries
       WHERE deleted_at IS NULL AND recorded_at >= ? AND recorded_at < ?`,
    )
    .get(monthStart.getTime(), monthEnd.getTime()) as { count: number };

  const weekRow = sqlite
    .prepare(
      `SELECT COUNT(*) AS count FROM entries
       WHERE deleted_at IS NULL AND recorded_at >= ?`,
    )
    .get(sevenDaysAgo.getTime()) as { count: number };

  const days = sqlite
    .prepare(
      `SELECT DISTINCT date(recorded_at / 1000, 'unixepoch', 'localtime') AS day
       FROM entries WHERE deleted_at IS NULL ORDER BY day DESC`,
    )
    .all() as { day: string }[];

  const followUpRow = sqlite
    .prepare(
      `SELECT COUNT(*) AS count FROM entries
       WHERE deleted_at IS NULL AND status = 'active'
         AND follow_up_at IS NOT NULL AND follow_up_at <= ?`,
    )
    .get(now.getTime()) as { count: number };

  const importantRow = sqlite
    .prepare(
      `SELECT COUNT(*) AS count FROM entries
       WHERE deleted_at IS NULL AND importance >= 4`,
    )
    .get() as { count: number };

  const daySet = new Set(days.map((row) => row.day));
  const today = new Date();
  const yesterday = addDays(today, -1);

  let cursor: Date | null = daySet.has(dayKey(today))
    ? today
    : daySet.has(dayKey(yesterday))
      ? yesterday
      : null;

  let streak = 0;
  while (cursor && daySet.has(dayKey(cursor))) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }

  return {
    total: totalRow.count,
    characters: totalRow.chars,
    thisMonth: monthRow.count,
    streak,
    last7Days: weekRow.count,
    pendingFollowUps: followUpRow.count,
    highImportance: importantRow.count,
  };
}

export function getUpcomingFollowUps(limit = 6, days = 7) {
  const now = new Date();
  const horizon = addDays(now, days);

  const rows = db
    .select()
    .from(entries)
    .where(
      and(
        isNull(entries.deletedAt),
        eq(entries.status, "active"),
        isNotNull(entries.followUpAt),
        lte(entries.followUpAt, horizon),
      ),
    )
    .orderBy(asc(entries.followUpAt))
    .limit(limit)
    .all();

  return attachRelations(rows);
}

export function getCategoryCounts(days = 90) {
  const from = addDays(new Date(), -days).getTime();

  return sqlite
    .prepare(
      `SELECT category, COUNT(*) AS count
       FROM entries
       WHERE deleted_at IS NULL AND event_time >= ?
       GROUP BY category
       ORDER BY count DESC`,
    )
    .all(from) as { category: EventCategory; count: number }[];
}

export function getMonthlyTrend(months = 6) {
  const now = new Date();
  const keys: { key: string; label: string; count: number }[] = [];

  for (let offset = months - 1; offset >= 0; offset -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    keys.push({
      key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
      label: `${date.getMonth() + 1} 月`,
      count: 0,
    });
  }

  const start = new Date(
    now.getFullYear(),
    now.getMonth() - (months - 1),
    1,
  );

  const rows = sqlite
    .prepare(
      `SELECT strftime('%Y-%m', event_time / 1000, 'unixepoch', 'localtime') AS month,
              COUNT(*) AS count
       FROM entries
       WHERE deleted_at IS NULL AND event_time >= ?
       GROUP BY month`,
    )
    .all(start.getTime()) as { month: string; count: number }[];

  const byKey = new Map(rows.map((row) => [row.month, row.count]));
  return keys.map((key) => ({
    key: key.key,
    label: key.label,
    count: byKey.get(key.key) ?? 0,
  }));
}

export function getTagCounts(): { name: string; count: number }[] {
  return sqlite
    .prepare(
      `SELECT t.name AS name, COUNT(*) AS count
       FROM tags t
       JOIN entry_tags et ON et.tag_id = t.id
       JOIN entries e ON e.id = et.entry_id
       WHERE e.deleted_at IS NULL
       GROUP BY t.name
       ORDER BY count DESC, t.name ASC
       LIMIT 24`,
    )
    .all() as { name: string; count: number }[];
}

export function getPersonCounts(): { name: string; count: number }[] {
  return sqlite
    .prepare(
      `SELECT p.name AS name, COUNT(*) AS count
       FROM people p
       JOIN entry_people ep ON ep.person_id = p.id
       JOIN entries e ON e.id = ep.entry_id
       WHERE e.deleted_at IS NULL
       GROUP BY p.name
       ORDER BY count DESC, p.name ASC
       LIMIT 24`,
    )
    .all() as { name: string; count: number }[];
}

export function getEntriesByIds(ids: string[]): EntryWithTags[] {
  if (ids.length === 0) return [];

  const rows = db
    .select()
    .from(entries)
    .where(and(inArray(entries.id, ids), isNull(entries.deletedAt)))
    .all();

  const withRelations = attachRelations(rows);
  const byId = new Map(withRelations.map((entry) => [entry.id, entry]));
  return ids
    .map((id) => byId.get(id))
    .filter((entry): entry is EntryWithTags => Boolean(entry));
}

export function countEligibleEntries() {
  const row = sqlite
    .prepare(
      `SELECT COUNT(*) AS count FROM entries
       WHERE deleted_at IS NULL AND sensitivity != 'local_only'`,
    )
    .get() as { count: number };

  return row.count;
}

export function getYearOverview(): { year: number; count: number }[] {
  return sqlite
    .prepare(
      `SELECT CAST(strftime('%Y', event_time / 1000, 'unixepoch', 'localtime') AS INTEGER) AS year,
              COUNT(*) AS count
       FROM entries
       WHERE deleted_at IS NULL
       GROUP BY year
       ORDER BY year DESC`,
    )
    .all() as { year: number; count: number }[];
}

export function exportEntries(): EntryWithTags[] {
  const rows = db
    .select()
    .from(entries)
    .where(isNull(entries.deletedAt))
    .orderBy(asc(entries.eventTime))
    .all();

  return attachRelations(rows);
}
