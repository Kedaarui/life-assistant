import { sqlite } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const sqliteVersion = sqlite
    .prepare("SELECT sqlite_version() AS version")
    .get() as { version: string };
  const vecVersion = sqlite
    .prepare("SELECT vec_version() AS version")
    .get() as { version: string };
  const counts = sqlite
    .prepare(
      "SELECT COUNT(*) AS events FROM entries WHERE deleted_at IS NULL",
    )
    .get() as { events: number };

  return Response.json({
    ok: true,
    database: "sqlite",
    sqlite: sqliteVersion.version,
    vector: vecVersion.version,
    events: counts.events,
  });
}
