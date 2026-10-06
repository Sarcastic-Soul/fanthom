import type { Metadata } from "next";
import Link from "next/link";
import { listClips } from "@/lib/data";
import { clock, shortDate } from "@/lib/format";
import { CopyLink } from "@/components/copy-link";

export const metadata: Metadata = { title: "Clips" };
export const revalidate = 30;

export default async function ClipsPage() {
  const clips = await listClips();
  return (
    <div className="page">
      <h1 className="page-title">Clips</h1>
      <p className="muted" style={{ margin: 0, maxWidth: "64ch" }}>
        Short parts of a meeting, saved from the transcript. Each one has a public link that plays just that part,
        so you can send it to someone who was not on the call.
      </p>
      <ul className="clips" style={{ marginTop: 28, borderTop: "1px solid var(--ink)" }}>
        {clips.map((c) => (
          <li key={c.id} className="clip-row" style={{ padding: "16px 0" }}>
            <div>
              <q>{c.quote.length > 260 ? c.quote.slice(0, 260) + "…" : c.quote}</q>
              <div className="muted" style={{ fontSize: 12.5, marginTop: 6 }}>
                <Link href={`/meetings/${c.meetings.slug}?t=${Math.floor(c.start_ms / 1000)}`}>{c.meetings.title}</Link>
                {" · "}
                {shortDate(c.meetings.started_at)} ·{" "}
                <span className="mono">
                  {clock(c.start_ms)}–{clock(c.end_ms)}
                </span>
              </div>
            </div>
            <div className="acts">
              <Link className="ts" href={`/share/clip/${c.id}`}>
                Open
              </Link>
              <CopyLink path={`/share/clip/${c.id}`} />
            </div>
          </li>
        ))}
      </ul>
      {clips.length === 0 && (
        <p className="muted" style={{ marginTop: 20 }}>
          No clips yet. Open a meeting, select a few lines of the transcript and press Create clip.
        </p>
      )}
    </div>
  );
}
