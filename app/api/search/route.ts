import {
  isEventCategory,
  isEventType,
} from "@/lib/event-meta";
import { serializeEntry } from "@/lib/modules/entries/service";
import { searchEntries } from "@/lib/modules/search/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim() ?? "";
  const rawYear = url.searchParams.get("year")?.trim() ?? "";
  const rawLimit = Number(url.searchParams.get("limit") ?? 20);
  const limit = Number.isFinite(rawLimit) ? rawLimit : 20;
  const rawCategory = url.searchParams.get("category");
  const category = isEventCategory(rawCategory) ? rawCategory : undefined;
  const rawEventType = url.searchParams.get("eventType");
  const eventType = isEventType(rawEventType) ? rawEventType : undefined;

  let from: Date | undefined;
  let to: Date | undefined;
  let timeLabel: string | undefined;

  if (/^\d{4}$/.test(rawYear)) {
    const year = Number(rawYear);
    from = new Date(year, 0, 1);
    to = new Date(year + 1, 0, 1);
    timeLabel = `${year} 年`;
  }

  const result = await searchEntries({
    query,
    from,
    to,
    timeLabel,
    category,
    eventType,
    limit,
  });

  return Response.json({
    query,
    mode: result.mode,
    semanticConfigured: result.semanticConfigured,
    timeFilter: result.timeFilter
      ? {
          label: result.timeFilter.label,
          from: result.timeFilter.from.toISOString(),
          to: result.timeFilter.to.toISOString(),
        }
      : null,
    results: result.results.map((hit) => ({
      entry: serializeEntry(hit.entry),
      snippet: hit.snippet,
      score: hit.score,
      matchedBy: hit.matchedBy,
    })),
  });
}
