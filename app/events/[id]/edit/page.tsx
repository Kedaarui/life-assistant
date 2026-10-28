import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EventForm } from "@/components/event-form";
import {
  getEntry,
  serializeEntry,
} from "@/lib/modules/entries/service";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const event = getEntry(id);
  return { title: event ? "修改这件事" : "记录不存在" };
}

export default async function EditEventPage({ params }: Props) {
  const { id } = await params;
  const event = getEntry(id);

  if (!event) notFound();

  return (
    <EventForm
      event={serializeEntry(event)}
      defaultEventTime={event.eventTime.toISOString()}
    />
  );
}
