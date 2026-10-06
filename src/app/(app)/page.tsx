import type { CSSProperties } from "react";
import Link from "next/link";
import { Faces } from "@/components/faces";
import { UploadButton } from "@/components/upload-button";
import { listMeetings } from "@/lib/data";
import { dayKey, minutes, speakerColor, timeOfDay } from "@/lib/format";
import type { MeetingListItem } from "@/lib/types";

export const revalidate = 60;

export default async function MeetingsPage() {
  const meetings = await listMeetings();

  const days = new Map<string, MeetingListItem[]>();
  for (const m of meetings) {
    const key = dayKey(m.started_at);
    days.set(key, [...(days.get(key) ?? []), m]);
  }
  const hours = meetings.reduce((t, m) => t + m.duration_ms, 0) / 3_600_000;

  return (
    <div className="page">
      <div className="list-head">
        <div>
          <h1 className="page-title">Meetings</h1>
          <p className="muted" style={{ margin: 0 }}>
            {meetings.length} recorded calls, {hours.toFixed(1)} hours in all. Real meetings from the
            AMI Meeting Corpus and GitLab&apos;s public YouTube channel.
          </p>
        </div>
        <UploadButton />
      </div>

      <ul className="mlist">
        {[...days.entries()].map(([day, list]) => (
          <li key={day}>
            <div className="day">
              <span>{day}</span>
            </div>
            {list.map((m) => (
              <MeetingRow key={m.id} m={m} />
            ))}
          </li>
        ))}
      </ul>
    </div>
  );
}

function MeetingRow({ m }: { m: MeetingListItem }) {
  const speakers = [...m.speakers].sort((a, b) => a.color - b.color);
  const talkTotal = speakers.reduce((t, s) => t + s.talk_ms, 0) || 1;
  const tldr = m.summaries?.[0]?.content?.tldr;
  return (
    <Link href={`/meetings/${m.slug}`} className="mrow">
      <span className="when">{timeOfDay(m.started_at)}</span>
      <div>
        <div className="mt">{m.title}</div>
        {tldr && <p className="gist">{tldr}</p>}
        <div className="src">
          {m.media_type === "youtube" ? "Video" : "Audio"} · {m.source_name}
        </div>
      </div>
      <div className="talk">
        <div className="talkbar" title="Share of talk time">
          {speakers.map((s) => (
            <i
              key={s.id}
              style={{ width: `${(s.talk_ms / talkTotal) * 100}%`, "--c": speakerColor(s.color) } as CSSProperties}
            />
          ))}
        </div>
        <Faces people={speakers} max={7} />
      </div>
      <span className="dur">{minutes(m.duration_ms)}</span>
    </Link>
  );
}
