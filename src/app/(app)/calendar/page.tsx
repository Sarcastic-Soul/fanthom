import type { Metadata } from "next";
import { CalendarView } from "@/components/calendar/calendar-view";
import { listMeetings } from "@/lib/data";

export const metadata: Metadata = { title: "Calendar" };
export const revalidate = 60;

export default async function CalendarPage() {
  const meetings = await listMeetings();
  const example = meetings.find((m) => m.status === "ready");
  return (
    <div className="page">
      <h1 className="page-title">Calendar</h1>
      <p className="muted" style={{ margin: 0, maxWidth: "64ch" }}>
        In the real product, Fanthom reads your calendar and sends a notetaker to each call you pick. It records,
        then writes the transcript and summary when the call ends.
      </p>
      <div className="banner">
        <b>This part is a stand-in.</b> There is no calendar connection and no bot joins any call. The events
        below are samples, and the switches only remember your choice in this browser. Every meeting in the
        workspace was recorded elsewhere and processed ahead of time.
      </div>
      <CalendarView example={example ? { slug: example.slug, title: example.title } : null} />
    </div>
  );
}
