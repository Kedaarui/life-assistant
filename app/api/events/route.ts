import { z } from "zod";
import {
  createEntry,
  listEntries,
  serializeEntry,
} from "@/lib/modules/entries/service";
import { indexEntry } from "@/lib/modules/search/indexer";
import {
  isEventCategory,
  isEventType,
} from "@/lib/event-meta";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createEventSchema = z.object({
  title: z.string().trim().min(1, "标题不能为空").max(200),
  description: z.string().trim().min(1, "描述不能为空").max(200_000),
  eventTime: z.coerce.date().optional(),
  eventTimeEnd: z.coerce.date().nullish(),
  eventPrecision: z.enum(["datetime", "day", "month", "year"]).optional(),
  timeNote: z.string().max(40).nullish(),
  sentiment: z.number().int().min(1).max(5).nullish(),
  category: z
    .enum([
      "work",
      "health",
      "relationship",
      "learning",
      "finance",
      "life",
      "other",
    ])
    .optional(),
  eventType: z
    .enum(["occurrence", "decision", "milestone", "issue", "meeting"])
    .optional(),
  importance: z.number().int().min(1).max(5).optional(),
  outcome: z.string().max(5000).nullish(),
  followUpAt: z.coerce.date().nullish(),
  location: z.string().max(200).nullish(),
  sensitivity: z.enum(["normal", "private", "local_only"]).optional(),
  tags: z.array(z.string().max(30)).max(20).optional(),
  people: z.array(z.string().max(40)).max(20).optional(),
});

function parseDate(value: string | null) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim() || undefined;
  const tag = url.searchParams.get("tag")?.trim() || undefined;
  const person = url.searchParams.get("person")?.trim() || undefined;
  const from = parseDate(url.searchParams.get("from"));
  const to = parseDate(url.searchParams.get("to"));
  const order = url.searchParams.get("order") === "asc" ? "asc" : "desc";

  const rawCategory = url.searchParams.get("category");
  const category = isEventCategory(rawCategory) ? rawCategory : undefined;
  const rawEventType = url.searchParams.get("eventType");
  const eventType = isEventType(rawEventType) ? rawEventType : undefined;

  const rawImportance = Number(url.searchParams.get("importanceMin"));
  const importanceMin =
    Number.isFinite(rawImportance) &&
    rawImportance >= 1 &&
    rawImportance <= 5
      ? rawImportance
      : undefined;

  const rawLimit = Number(url.searchParams.get("limit") ?? 100);
  const limit = Number.isFinite(rawLimit) ? rawLimit : 100;

  const rows = listEntries({
    q,
    tag,
    person,
    category,
    eventType,
    importanceMin,
    from,
    to,
    limit,
    order,
  });

  return Response.json({ events: rows.map(serializeEntry) });
}

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "请求体不是合法的 JSON" }, { status: 400 });
  }

  const parsed = createEventSchema.safeParse(payload);
  if (!parsed.success) {
    return Response.json(
      { error: "参数校验失败", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const event = createEntry(parsed.data);

  try {
    await indexEntry(event.id);
  } catch (error) {
    console.error("[events] indexing failed", error);
  }

  return Response.json({ event: serializeEntry(event) }, { status: 201 });
}
