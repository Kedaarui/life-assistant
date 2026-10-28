import {
  exportEntries,
  serializeEntry,
} from "@/lib/modules/entries/service";
import { dayKey } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const events = exportEntries().map(serializeEntry);

  const payload = {
    app: "个人生活助手",
    formatVersion: 2,
    exportedAt: new Date().toISOString(),
    eventCount: events.length,
    events,
  };

  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="life-assistant-events-${dayKey(
        new Date(),
      )}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
