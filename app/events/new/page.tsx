import type { Metadata } from "next";
import { EventForm } from "@/components/event-form";

export const metadata: Metadata = { title: "记一件事" };

type SearchParams = Promise<{ date?: string }>;

export default async function NewEventPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const requested =
    typeof params.date === "string" ? new Date(params.date) : new Date();
  const initial = Number.isNaN(requested.getTime())
    ? new Date()
    : requested;

  return <EventForm defaultEventTime={initial.toISOString()} />;
}
