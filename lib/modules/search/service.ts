import "server-only";
import { getEmbeddingConfig, getEmbeddingStatus } from "@/lib/ai/embedding-config";
import { embedTexts } from "@/lib/ai/embeddings";
import { sqlite } from "@/lib/db";
import type { EventCategory, EventType } from "@/lib/event-meta";
import {
  getEntriesByIds,
  listEntries,
  type EntryWithTags,
} from "@/lib/modules/entries/service";
import { excerpt } from "@/lib/utils";
import { parseTimeQuery, type TimeFilter } from "./time-query";

export type SearchSource = "keyword" | "fts" | "semantic";

export type SearchHit = {
  entry: EntryWithTags;
  snippet: string;
  score: number;
  matchedBy: SearchSource[];
};

export type SearchMode = "hybrid" | "keyword" | "vector" | "time" | "browse";

export type SearchResponse = {
  results: SearchHit[];
  timeFilter: TimeFilter | null;
  mode: SearchMode;
  semanticConfigured: boolean;
};

type SearchOptions = {
  query: string;
  from?: Date;
  to?: Date;
  timeLabel?: string;
  category?: EventCategory;
  eventType?: EventType;
  limit?: number;
  signal?: AbortSignal;
};

type Candidate = {
  chunkId: string;
  entryId: string;
  score: number;
  hits: number;
  distance: number;
  matchedBy: Set<SearchSource>;
};

const RRF_K = 60;
const KEYWORD_LIMIT = 80;
const FTS_LIMIT = 40;
const VECTOR_LIMIT = 60;
const SEMANTIC_DISTANCE_WINDOW = 0.1;
const MAX_SEMANTIC_DISTANCE = 1.35;

function buildTerms(query: string) {
  const terms = new Set<string>();
  const normalized = query
    .replace(/[，,。！!？?、；;：:\s]+/g, " ")
    .trim();

  if (!normalized) return [];

  for (const token of normalized.split(/\s+/)) {
    if (!token) continue;

    if (/[一-鿿]/.test(token)) {
      if (token.length <= 8) terms.add(token);
      if (token.length === 1) terms.add(token);
      for (let index = 0; index < token.length - 1; index += 1) {
        terms.add(token.slice(index, index + 2));
      }
    } else if (token.length >= 2) {
      terms.add(token.toLowerCase());
    }

    if (terms.size >= 16) break;
  }

  return [...terms].slice(0, 16);
}

function timeClause(columnPrefix: "e." | "") {
  return `AND ${columnPrefix}event_time < ? AND COALESCE(${columnPrefix}event_time_end, ${columnPrefix}event_time + 1) > ?`;
}

function keywordSearch(
  terms: string[],
  filter: TimeFilter | null,
  category: EventCategory | undefined,
  eventType: EventType | undefined,
  limit = KEYWORD_LIMIT,
) {
  if (terms.length === 0) return [];

  const hitExpression = terms
    .map(
      () =>
        "CASE WHEN instr(lower(c.text), lower(?)) > 0 THEN 1 ELSE 0 END",
    )
    .join(" + ");
  const matchExpression = terms
    .map(() => "instr(lower(c.text), lower(?)) > 0")
    .join(" OR ");

  const bindings: Array<string | number> = [...terms];
  let extra = "";
  if (filter) {
    extra += ` ${timeClause("e.")}`;
    bindings.push(filter.to.getTime(), filter.from.getTime());
  }
  if (category) {
    extra += " AND e.category = ?";
    bindings.push(category);
  }
  if (eventType) {
    extra += " AND e.event_type = ?";
    bindings.push(eventType);
  }
  bindings.push(...terms, limit);

  const rows = sqlite
    .prepare(
      `SELECT c.id AS chunk_id, c.entry_id AS entry_id,
              (${hitExpression}) AS hits
       FROM chunks c
       JOIN entries e ON e.id = c.entry_id
       WHERE e.deleted_at IS NULL
         AND e.sensitivity != 'local_only'
         ${extra}
         AND (${matchExpression})
       ORDER BY hits DESC, e.event_time DESC
       LIMIT ?`,
    )
    .all(...bindings) as {
    chunk_id: string;
    entry_id: string;
    hits: number;
  }[];

  // A multi-term query should match more than one fragment; this keeps a
  // single incidental bigram from flooding the result list.
  const minHits = terms.length >= 4 ? 2 : 1;
  return rows.filter((row) => row.hits >= minHits);
}

function ftsSearch(
  terms: string[],
  filter: TimeFilter | null,
  category: EventCategory | undefined,
  eventType: EventType | undefined,
  limit = FTS_LIMIT,
) {
  const ftsTerms = terms.filter((term) => term.length >= 3);
  if (ftsTerms.length === 0) return [];

  const match = ftsTerms
    .map((term) => `"${term.replace(/"/g, '""')}"`)
    .join(" OR ");
  const bindings: Array<string | number> = [match];
  let extra = "";
  if (filter) {
    extra += ` ${timeClause("e.")}`;
    bindings.push(filter.to.getTime(), filter.from.getTime());
  }
  if (category) {
    extra += " AND e.category = ?";
    bindings.push(category);
  }
  if (eventType) {
    extra += " AND e.event_type = ?";
    bindings.push(eventType);
  }
  bindings.push(limit);

  try {
    return sqlite
      .prepare(
        `SELECT f.chunk_id AS chunk_id, f.entry_id AS entry_id,
                bm25(chunks_fts) AS rank
         FROM chunks_fts f
         JOIN entries e ON e.id = f.entry_id
         WHERE chunks_fts MATCH ?
           AND e.deleted_at IS NULL
           AND e.sensitivity != 'local_only'
           ${extra}
         ORDER BY rank
         LIMIT ?`,
      )
      .all(...bindings) as {
      chunk_id: string;
      entry_id: string;
      rank: number;
    }[];
  } catch (error) {
    console.error("[search] FTS query failed:", error);
    return [];
  }
}

async function semanticSearch(
  query: string,
  filter: TimeFilter | null,
  signal?: AbortSignal,
) {
  const embedding = getEmbeddingConfig();
  if (!embedding || !query.trim()) {
    return { rows: [], used: false };
  }

  try {
    const [vector] = await embedTexts([query], signal);
    const bindings: Array<string | number> = [JSON.stringify(vector)];
    let time = "";
    if (filter) {
      time = "AND event_time < ? AND event_time_end > ?";
      bindings.push(filter.to.getTime(), filter.from.getTime());
    }

    const rows = sqlite
      .prepare(
        `SELECT chunk_id, entry_id, distance
         FROM chunk_vectors
         WHERE embedding MATCH ? AND k = ${VECTOR_LIMIT}
           ${time}
         ORDER BY distance`,
      )
      .all(...bindings) as {
      chunk_id: string;
      entry_id: string;
      distance: number;
    }[];

    if (rows.length === 0) {
      return { rows, used: true };
    }

    const bestDistance = Math.min(
      ...rows.map((row) => row.distance),
    );
    const cutoff = Math.min(
      bestDistance + SEMANTIC_DISTANCE_WINDOW,
      MAX_SEMANTIC_DISTANCE,
    );

    return {
      rows: rows.filter((row) => row.distance <= cutoff),
      used: true,
    };
  } catch (error) {
    console.error("[search] semantic query failed:", error);
    return { rows: [], used: false };
  }
}

function addCandidate(
  map: Map<string, Candidate>,
  row: {
    chunk_id: string;
    entry_id: string;
    hits?: number;
    distance?: number;
  },
  source: SearchSource,
  rank: number,
) {
  let candidate = map.get(row.chunk_id);
  if (!candidate) {
    candidate = {
      chunkId: row.chunk_id,
      entryId: row.entry_id,
      score: 0,
      hits: 0,
      distance: Number.POSITIVE_INFINITY,
      matchedBy: new Set(),
    };
    map.set(row.chunk_id, candidate);
  }

  candidate.score += 1 / (RRF_K + rank);
  candidate.hits += row.hits ?? 0;
  if (row.distance !== undefined) {
    candidate.distance = Math.min(candidate.distance, row.distance);
  }
  candidate.matchedBy.add(source);
}

function fetchChunkTexts(ids: string[]) {
  if (ids.length === 0) return new Map<string, string>();

  const placeholders = ids.map(() => "?").join(", ");
  const rows = sqlite
    .prepare(`SELECT id, text FROM chunks WHERE id IN (${placeholders})`)
    .all(...ids) as { id: string; text: string }[];

  return new Map(rows.map((row) => [row.id, row.text]));
}

function makeSnippet(text: string, terms: string[], maxLength = 180) {
  const lowerText = text.toLowerCase();
  let firstIndex = -1;

  for (const term of terms) {
    const index = lowerText.indexOf(term.toLowerCase());
    if (index >= 0 && (firstIndex < 0 || index < firstIndex)) {
      firstIndex = index;
    }
  }

  if (firstIndex < 0) return excerpt(text, maxLength);

  const start = Math.max(0, firstIndex - Math.floor(maxLength / 3));
  const end = Math.min(text.length, start + maxLength);
  return `${start > 0 ? "…" : ""}${text
    .slice(start, end)
    .trim()}${end < text.length ? "…" : ""}`;
}

export async function searchEntries(
  options: SearchOptions,
): Promise<SearchResponse> {
  const limit = Math.min(Math.max(options.limit ?? 20, 1), 50);
  const embeddingStatus = getEmbeddingStatus();
  const parsed = parseTimeQuery(options.query);
  const filter: TimeFilter | null =
    options.from && options.to
      ? {
          from: options.from,
          to: options.to,
          label: options.timeLabel ?? "指定时间",
        }
      : parsed.filter;
  const cleanedQuery = parsed.cleaned;
  const terms = buildTerms(cleanedQuery);

  if (!cleanedQuery) {
    if (!filter) {
      return {
        results: [],
        timeFilter: null,
        mode: "browse",
        semanticConfigured: embeddingStatus.configured,
      };
    }

    const entries = listEntries({
      from: filter.from,
      to: filter.to,
      category: options.category,
      eventType: options.eventType,
      limit,
      order: "desc",
    });

    return {
      results: entries.map((entry) => ({
        entry,
        snippet: excerpt(entry.contentMd, 180),
        score: 0,
        matchedBy: [],
      })),
      timeFilter: filter,
      mode: "time",
      semanticConfigured: embeddingStatus.configured,
    };
  }

  const keywordRows = keywordSearch(
    terms,
    filter,
    options.category,
    options.eventType,
  );
  const ftsRows = ftsSearch(
    terms,
    filter,
    options.category,
    options.eventType,
  );
  const semantic = await semanticSearch(
    cleanedQuery,
    filter,
    options.signal,
  );

  const candidates = new Map<string, Candidate>();

  keywordRows.forEach((row, index) => {
    addCandidate(candidates, row, "keyword", index + 1);
  });
  ftsRows.forEach((row, index) => {
    addCandidate(candidates, row, "fts", index + 1);
  });
  semantic.rows.forEach((row, index) => {
    addCandidate(candidates, row, "semantic", index + 1);
  });

  if (candidates.size === 0) {
    return {
      results: [],
      timeFilter: filter,
      mode: semantic.used ? "vector" : "keyword",
      semanticConfigured: embeddingStatus.configured,
    };
  }

  const entryScores = new Map<
    string,
    { score: number; chunkId: string; matchedBy: Set<SearchSource>; hits: number }
  >();

  for (const candidate of candidates.values()) {
    const existing = entryScores.get(candidate.entryId);
    const matchedBy = new Set([
      ...(existing?.matchedBy ?? []),
      ...candidate.matchedBy,
    ]);

    if (
      !existing ||
      candidate.score > existing.score ||
      (candidate.score === existing.score && candidate.hits > existing.hits)
    ) {
      entryScores.set(candidate.entryId, {
        score: candidate.score + (matchedBy.size - 1) * 0.01,
        chunkId: candidate.chunkId,
        matchedBy,
        hits: candidate.hits,
      });
    } else {
      existing.matchedBy = matchedBy;
      existing.score += (matchedBy.size - 1) * 0.001;
    }
  }

  const rankedEntryIds = [...entryScores.entries()]
    .sort((a, b) => b[1].score - a[1].score)
    .slice(0, limit * 2)
    .map(([entryId]) => entryId);

  const entries = getEntriesByIds(rankedEntryIds);
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  const chunkIds = rankedEntryIds
    .map((entryId) => entryScores.get(entryId)?.chunkId)
    .filter((id): id is string => Boolean(id));
  const texts = fetchChunkTexts(chunkIds);

  const results: SearchHit[] = [];

  for (const entryId of rankedEntryIds) {
    const entry = byId.get(entryId);
    const scored = entryScores.get(entryId);
    if (!entry || !scored || entry.sensitivity === "local_only") continue;
    if (options.category && entry.category !== options.category) continue;
    if (options.eventType && entry.eventType !== options.eventType) continue;

    results.push({
      entry,
      snippet: makeSnippet(texts.get(scored.chunkId) ?? entry.contentMd, terms),
      score: scored.score,
      matchedBy: [...scored.matchedBy],
    });

    if (results.length >= limit) break;
  }

  results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.entry.eventTime.getTime() - a.entry.eventTime.getTime();
  });

  const mode: SearchMode = semantic.used
    ? keywordRows.length > 0 || ftsRows.length > 0
      ? "hybrid"
      : "vector"
    : "keyword";

  return {
    results,
    timeFilter: filter,
    mode,
    semanticConfigured: embeddingStatus.configured,
  };
}

export async function searchForChat(
  query: string,
  limit = 10,
  signal?: AbortSignal,
) {
  const search = await searchEntries({
    query,
    limit: limit + 4,
    signal,
  });

  const recent = search.timeFilter
    ? []
    : listEntries({ limit: 3, order: "desc" });
  const byId = new Map<string, EntryWithTags>();

  for (const hit of search.results) {
    if (hit.entry.sensitivity === "local_only") continue;
    byId.set(hit.entry.id, hit.entry);
  }
  for (const entry of recent) {
    if (entry.sensitivity === "local_only") continue;
    if (!byId.has(entry.id)) byId.set(entry.id, entry);
  }

  const entries = [...byId.values()].slice(0, limit);

  return {
    entries,
    mode: search.mode,
    timeFilter: search.timeFilter,
  };
}
