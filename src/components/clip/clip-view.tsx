"use client";

import { useEffect, useMemo, type CSSProperties } from "react";
import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react";
import { PlayerProvider, usePlayer } from "@/components/player/context";
import { useActiveIndex } from "@/components/player/hooks";
import { PlayerBox } from "@/components/meeting/side";
import { clock, minutes, shortDate, speakerColor } from "@/lib/format";
import type { Highlight, MeetingDetail } from "@/lib/types";

export function ClipView(props: { data: MeetingDetail; clip: Highlight }) {
  return (
    <PlayerProvider>
      <ClipInner {...props} />
    </PlayerProvider>
  );
}

function ClipInner({ data, clip }: { data: MeetingDetail; clip: Highlight }) {
  const { meeting, speakers, utterances } = data;
  const store = usePlayer();
  const speakerById = useMemo(() => new Map(speakers.map((s) => [s.id, s])), [speakers]);
  const lines = useMemo(
    () => utterances.filter((u) => u.start_ms < clip.end_ms && u.end_ms > clip.start_ms),
    [utterances, clip],
  );
  const inClip = useMemo(() => new Set(lines.map((l) => l.speaker_id)), [lines]);
  const clipSpeakers = speakers.filter((s) => inClip.has(s.id));
  const active = useActiveIndex(lines);

  // Start at the clip and stop at its end, so the link plays only that part.
  useEffect(() => {
    store.seek(clip.start_ms, false);
    const off = store.subscribe(() => {
      const s = store.get();
      if (s.playing && s.ms >= clip.end_ms) {
        store.pause();
        store.seek(clip.start_ms, false);
      }
    });
    return () => {
      off();
    };
  }, [store, clip]);

  return (
    <div className="share">
      <Link href="/" className="brand">
        Fanth<i>o</i>m
      </Link>
      <p className="muted" style={{ fontSize: 13, marginTop: 28, marginBottom: 0 }}>
        A clip from <b style={{ color: "var(--ink)", fontWeight: 500 }}>{meeting.title}</b> · {shortDate(meeting.started_at)}{" "}
        · {minutes(clip.end_ms - clip.start_ms)} of {minutes(meeting.duration_ms)}
      </p>
      <p className="quote">“{clip.quote.length > 320 ? clip.quote.slice(0, 320) + "…" : clip.quote}”</p>

      <PlayerBox
        meeting={meeting}
        speakers={clipSpeakers.length ? clipSpeakers : speakers}
        utterances={utterances}
        speakerById={speakerById}
      />

      <div className="tx-list">
        {lines.map((u, i) => {
          const s = speakerById.get(u.speaker_id);
          return (
            <div
              key={u.id}
              className={`line${i === active ? " now" : ""}`}
              style={{ "--c": speakerColor(s?.color ?? 0) } as CSSProperties}
              onClick={() => store.seek(Math.max(u.start_ms, clip.start_ms))}
            >
              <span className="t">{clock(u.start_ms)}</span>
              <div>
                <div className="who">
                  <i className="dot" />
                  {s?.name}
                </div>
                <div className="say">{u.text}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 24, flexWrap: "wrap" }}>
        <Link className="btn primary" href={`/meetings/${meeting.slug}?t=${Math.floor(clip.start_ms / 1000)}`}>
          See the whole meeting <ArrowRight size={14} />
        </Link>
        <Link className="btn" href="/">
          Browse the demo workspace
        </Link>
      </div>
      <p className="colophon">
        Shared from the Fanthom demo workspace. No sign-in needed to watch. {meeting.credit}
      </p>
    </div>
  );
}
