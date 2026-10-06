// Sample calendar for the stubbed capture layer. There is no real calendar
// connection in this demo; the UI says so wherever this list is shown.

export type SampleEvent = {
  id: string;
  title: string;
  startsAt: string;
  minutes: number;
  platform: "Zoom" | "Google Meet" | "Microsoft Teams";
  attendees: number;
  recordByDefault: boolean;
};

export const SAMPLE_EVENTS: SampleEvent[] = [
  { id: "e1", title: "Plan stage weekly sync", startsAt: "2026-10-07T04:30:00Z", minutes: 60, platform: "Zoom", attendees: 8, recordByDefault: true },
  { id: "e2", title: "1:1 with Priya", startsAt: "2026-10-07T06:00:00Z", minutes: 30, platform: "Google Meet", attendees: 2, recordByDefault: true },
  { id: "e3", title: "Design review: approvals sidebar", startsAt: "2026-10-07T09:00:00Z", minutes: 45, platform: "Google Meet", attendees: 5, recordByDefault: true },
  { id: "e4", title: "Customer call: Northwind", startsAt: "2026-10-07T11:30:00Z", minutes: 30, platform: "Microsoft Teams", attendees: 4, recordByDefault: false },
  { id: "e5", title: "Engineering all hands", startsAt: "2026-10-08T15:00:00Z", minutes: 60, platform: "Zoom", attendees: 42, recordByDefault: false },
  { id: "e6", title: "Sprint retro", startsAt: "2026-10-09T08:00:00Z", minutes: 45, platform: "Zoom", attendees: 7, recordByDefault: true },
];
