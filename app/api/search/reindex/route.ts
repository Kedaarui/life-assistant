import {
  getIndexStatus,
  indexAllEntries,
} from "@/lib/modules/search/indexer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST() {
  const result = await indexAllEntries();

  return Response.json({
    ...result,
    status: getIndexStatus(),
  });
}
