import "server-only";
import { and, asc, eq, isNull, ne } from "drizzle-orm";
import {
  getEmbeddingConfig,
  getEmbeddingStatus,
} from "@/lib/ai/embedding-config";
import { embedTexts } from "@/lib/ai/embeddings";
import { db, sqlite } from "@/lib/db";
import {
  chunks,
  entries,
  entryPeople,
  people,
  settings,
} from "@/lib/db/schema";
import {
  categoryLabel,
  eventTypeLabel,
  importanceLabel,
  sentimentLabel,
} from "@/lib/event-meta";
import { chunkText } from "./chunker";

export type IndexEntryResult = {
  entryId: string;
  chunks: number;
  embedded: boolean;
  error?: string;
};

export type IndexStatus = {
  totalEntries: number;
  indexedEntries: number;
  chunkCount: number;
  vectorCount: number;
  embeddingConfigured: boolean;
  storedModel: string | null;
  storedDim: number | null;
  currentModel: string;
  stale: boolean;
};

const MODEL_KEY = "search.embedding_model";
const DIM_KEY = "search.embedding_dim";
const INDEXED_AT_KEY = "search.indexed_at";

function getSetting(key: string) {
  return (
    db.select().from(settings).where(eq(settings.key, key)).get()?.value ??
    null
  );
}

function setSetting(key: string, value: string) {
  const now = new Date();
  db.insert(settings)
    .values({ key, value, updatedAt: now })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value, updatedAt: now },
    })
    .run();
}

export function removeEntryIndex(entryId: string) {
  const chunkRows = db
    .select({ id: chunks.id })
    .from(chunks)
    .where(eq(chunks.entryId, entryId))
    .all();

  sqlite
    .prepare("DELETE FROM chunk_vectors WHERE entry_id = ?")
    .run(entryId);

  if (chunkRows.length > 0) {
    const deleteFts = sqlite.prepare(
      "DELETE FROM chunks_fts WHERE chunk_id = ?",
    );
    const removeFts = sqlite.transaction((rows: { id: string }[]) => {
      for (const row of rows) deleteFts.run(row.id);
    });
    removeFts(chunkRows);
  }

  db.delete(chunks).where(eq(chunks.entryId, entryId)).run();
}

export async function indexEntry(
  entryId: string,
  options: { signal?: AbortSignal } = {},
): Promise<IndexEntryResult> {
  const entry = db
    .select()
    .from(entries)
    .where(and(eq(entries.id, entryId), isNull(entries.deletedAt)))
    .get();

  if (!entry || entry.sensitivity === "local_only") {
    removeEntryIndex(entryId);
    return { entryId, chunks: 0, embedded: false };
  }

  removeEntryIndex(entryId);

  const relatedPeople = db
    .select({ name: people.name })
    .from(entryPeople)
    .innerJoin(people, eq(people.id, entryPeople.personId))
    .where(eq(entryPeople.entryId, entryId))
    .all();

  const metadata = [
    categoryLabel(entry.category),
    eventTypeLabel(entry.eventType),
    `分量${importanceLabel(entry.importance)}`,
    entry.sentiment
      ? `心情${sentimentLabel(entry.sentiment)}`
      : "",
    relatedPeople.length > 0
      ? `一起的人 ${relatedPeople.map((person) => person.name).join(" ")}`
      : "",
    entry.location ? `地点 ${entry.location}` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  const sourceText = [
    entry.title,
    entry.contentMd,
    entry.outcome,
    metadata,
  ]
    .filter(Boolean)
    .join("\n");
  const parts = chunkText(sourceText);

  if (parts.length === 0) {
    return { entryId, chunks: 0, embedded: false };
  }

  const now = new Date();
  const rows = parts.map((text, seq) => ({
    id: crypto.randomUUID(),
    entryId,
    seq,
    text,
    tokens: Math.ceil(text.length / 2),
    createdAt: now,
  }));

  db.insert(chunks).values(rows).run();

  const insertFts = sqlite.prepare(
    "INSERT INTO chunks_fts(chunk_id, entry_id, text) VALUES (?, ?, ?)",
  );
  const insertFtsRows = sqlite.transaction(
    (items: typeof rows) => {
      for (const item of items) {
        insertFts.run(item.id, entryId, item.text);
      }
    },
  );
  insertFtsRows(rows);

  let embedded = false;
  let error: string | undefined;

  if (getEmbeddingConfig()) {
    try {
      const vectors = await embedTexts(
        rows.map((row) => row.text),
        options.signal,
      );
      const eventTimeEnd =
        entry.eventTimeEnd ?? new Date(entry.eventTime.getTime() + 1);
      const insertVector = sqlite.prepare(
        `INSERT INTO chunk_vectors(
           chunk_id, entry_id, event_time, event_time_end, embedding
         ) VALUES (?, ?, ?, ?, ?)`,
      );
      const insertVectors = sqlite.transaction(
        (items: typeof rows, embeddings: number[][]) => {
          for (let index = 0; index < items.length; index += 1) {
            insertVector.run(
              items[index].id,
              entryId,
              entry.eventTime.getTime(),
              eventTimeEnd.getTime(),
              JSON.stringify(embeddings[index]),
            );
          }
        },
      );
      insertVectors(rows, vectors);
      embedded = true;

      // Bootstrap the index state on a fresh database. A full reindex is still
      // what records a model change after this point.
      if (getSetting(MODEL_KEY) === null) {
        recordIndexState();
      }
    } catch (caught) {
      error =
        caught instanceof Error ? caught.message : "Embedding 失败";
      console.error(`[search] embedding failed for ${entryId}:`, error);
    }
  }

  return {
    entryId,
    chunks: rows.length,
    embedded,
    ...(error ? { error } : {}),
  };
}

export function recordIndexState() {
  const embedding = getEmbeddingConfig();
  setSetting(MODEL_KEY, embedding?.model ?? "none");
  setSetting(DIM_KEY, String(embedding?.dim ?? 0));
  setSetting(INDEXED_AT_KEY, new Date().toISOString());
}

export async function indexAllEntries() {
  const rows = db
    .select({ id: entries.id })
    .from(entries)
    .where(
      and(
        isNull(entries.deletedAt),
        ne(entries.sensitivity, "local_only"),
      ),
    )
    .orderBy(asc(entries.eventTime))
    .all();

  let indexed = 0;
  let failed = 0;
  let chunkCount = 0;

  for (const row of rows) {
    const result = await indexEntry(row.id);
    if (result.error) {
      failed += 1;
    } else {
      indexed += 1;
    }
    chunkCount += result.chunks;
  }

  if (failed === 0) {
    recordIndexState();
  }

  return {
    total: rows.length,
    indexed,
    failed,
    chunks: chunkCount,
  };
}

export function getIndexStatus(): IndexStatus {
  const counts = sqlite
    .prepare(
      `SELECT
         (SELECT COUNT(*) FROM entries
          WHERE deleted_at IS NULL AND sensitivity != 'local_only') AS total_entries,
         (SELECT COUNT(DISTINCT c.entry_id) FROM chunks c
          JOIN entries e ON e.id = c.entry_id
          WHERE e.deleted_at IS NULL AND e.sensitivity != 'local_only') AS indexed_entries,
         (SELECT COUNT(*) FROM chunks c
          JOIN entries e ON e.id = c.entry_id
          WHERE e.deleted_at IS NULL AND e.sensitivity != 'local_only') AS chunk_count,
         (SELECT COUNT(*) FROM chunk_vectors v
          JOIN chunks c ON c.id = v.chunk_id
          JOIN entries e ON e.id = c.entry_id
          WHERE e.deleted_at IS NULL AND e.sensitivity != 'local_only') AS vector_count`,
    )
    .get() as {
    total_entries: number;
    indexed_entries: number;
    chunk_count: number;
    vector_count: number;
  };

  const embedding = getEmbeddingStatus();
  const storedModel = getSetting(MODEL_KEY);
  const storedDimRaw = getSetting(DIM_KEY);
  const storedDim =
    storedDimRaw === null ? null : Number(storedDimRaw);

  const modelMismatch =
    embedding.configured &&
    storedModel !== null &&
    (storedModel !== embedding.model || storedDim !== embedding.dim);
  const noState =
    embedding.configured && storedModel === null && counts.chunk_count > 0;
  const missingVectors =
    embedding.configured &&
    counts.vector_count < counts.chunk_count;

  return {
    totalEntries: counts.total_entries,
    indexedEntries: counts.indexed_entries,
    chunkCount: counts.chunk_count,
    vectorCount: counts.vector_count,
    embeddingConfigured: embedding.configured,
    storedModel,
    storedDim,
    currentModel: embedding.model,
    stale: modelMismatch || noState || missingVectors,
  };
}
