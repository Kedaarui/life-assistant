import { z } from "zod";
import {
  deleteEntry,
  getEntry,
  serializeEntry,
  updateEntry,
} from "@/lib/modules/entries/service";
import {
  indexEntry,
  removeEntryIndex,
} from "@/lib/modules/search/indexer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const updateEventSchema = z
  .object({
    title: z.string().trim().min(1, "标题不能为空").max(200).optional(),
    description: z
      .string()
      .trim()
      .min(1, "描述不能为空")
      .max(200_000)
      .optional(),
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
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "没有需要更新的字段",
  });

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const event = getEntry(id);

  if (!event) {
    return Response.json({ error: "事件不存在" }, { status: 404 });
  }

  return Response.json({ event: serializeEntry(event) });
}

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "请求体不是合法的 JSON" }, { status: 400 });
  }

  const parsed = updateEventSchema.safeParse(payload);
  if (!parsed.success) {
    return Response.json(
      { error: "参数校验失败", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const event = updateEntry(id, parsed.data);
  if (!event) {
    return Response.json({ error: "事件不存在" }, { status: 404 });
  }

  try {
    await indexEntry(event.id);
  } catch (error) {
    console.error("[events] indexing failed", error);
  }

  return Response.json({ event: serializeEntry(event) });
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  const deleted = deleteEntry(id);

  if (!deleted) {
    return Response.json({ error: "事件不存在" }, { status: 404 });
  }

  try {
    removeEntryIndex(id);
  } catch (error) {
    console.error("[events] removing index failed", error);
  }

  return Response.json({ ok: true });
}
