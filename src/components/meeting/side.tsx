"use client";

import { useMemo, type CSSProperties, type MouseEvent } from "react";
import {
  ArrowArcLeft,
  ArrowArcRight,
  Pause,
  Play,
} from "@phosphor-icons/react";
import { HtmlMedia } from "@/components/player/html-media";
import { YouTubeMedia } from "@/components/player/youtube";
import { usePlayer, usePlayerState } from "@/components/player/context";
import { useActiveIndex } from "@/components/player/hooks";
import { clock, initials, speakerColor } from "@/lib/format";
import type { Chapter, Highlight, Meeting, Speaker, Utterance } from "@/lib/types";

const RATES = [1, 1.25, 1.5, 2];

export function PlayerBox({
  meeting,
  speakers,
  utterances,
  speakerById,
}: {
  meeting: Meeting;
  speakers: Speaker[];
  utterances: Utterance[];
  speakerById: Map<string, Speaker>;
}) {
  return (
    <div className="player">
      {meeting.media_type === "youtube" && meeting.youtube_id ? (
        <YouTubeMedia videoId={meeting.youtube_id} className="screen yt" />
      ) : (
        <>
          <SpeakerTiles speakers={speakers} utterances={utterances} speakerById={speakerById} />
          {meeting.media_url && (
            <HtmlMedia src={meeting.media_url} kind={meeting.media_type === "video" ? "video" : "audio"} />
          )}
        </>
      )}
      <Controls durationMs={meeting.duration_ms} />
    </div>
  );
}

// Audio-only meetings get a poster of speaker tiles; the one talking now is outlined.
function SpeakerTiles({
  speakers,
  utterances,
  speakerById,
}: {
  speakers: Speaker[];
  utterances: Utterance[];
  speakerById: Map<string, Speaker>;
}) {
  const active = useActiveIndex(utterances);
  const ms = usePlayerState((s) => Math.floor(s.ms / 500));
  const u = active >= 0 ? utterances[active] : null;
  const talking = u && ms * 500 <= u.end_ms + 400 ? speakerById.get(u.speaker_id)?.id : null;
  const shown = speakers.slice(0, 10);
  return (
    <div className={`screen${shown.length > 8 ? " many" : ""}`} aria-label="Audio recording">
      {shown.map((s) => (
        <div
          key={s.id}
          className={`tile${talking === s.id ? " talking" : ""}`}
          style={{ "--c": speakerColor(s.color) } as CSSProperties}
        >
          <span className="av">{initials(s.name)}</span>
          <span className="nm">{s.name}</span>
        </div>
      ))}
      <span className="screen-note">audio only</span>
    </div>
  );
}

function Controls({ durationMs }: { durationMs: number }) {
  const store = usePlayer();
  const playing = usePlayerState((s) => s.playing);
  const sec = usePlayerState((s) => Math.floor(s.ms / 1000));
  const rate = usePlayerState((s) => s.rate);
  const ready = usePlayerState((s) => s.ready);
  return (
    <div className="ctl">
      <button
        className="play"
        aria-label={playing ? "Pause" : "Play"}
        onClick={() => (playing ? store.pause() : store.play())}
        disabled={!ready}
      >
        {playing ? <Pause size={14} weight="fill" /> : <Play size={14} weight="fill" />}
      </button>
      <span className="clock mono">
        <b>{clock(sec * 1000)}</b> / {clock(durationMs)}
      </span>
      <div className="r">
        <button aria-label="Back 15 seconds" title="Back 15 s" onClick={() => store.seek(Math.max(0, sec * 1000 - 15000), playing)}>
          <ArrowArcLeft size={16} />
        </button>
        <button aria-label="Forward 15 seconds" title="Forward 15 s" onClick={() => store.seek(sec * 1000 + 15000, playing)}>
          <ArrowArcRight size={16} />
        </button>
        <button
          className="mono"
          title="Playback speed"
          onClick={() => store.setRate(RATES[(RATES.indexOf(rate) + 1) % RATES.length])}
        >
          {rate}×
        </button>
      </div>
    </div>
  );
}

export function Timeline({
  speakers,
  utterances,
  chapters,
  highlights,
  durationMs,
  hidden,
  onToggleSpeaker,
}: {
  speakers: Speaker[];
  utterances: Utterance[];
  chapters: Chapter[];
  highlights: Highlight[];
  durationMs: number;
  hidden: Set<string>;
  onToggleSpeaker: (id: string) => void;
}) {
  const store = usePlayer();
  const dur = Math.max(durationMs, 1);

  // Merge each speaker's lines into spans, joining gaps under two seconds.
  const lanes = useMemo(() => {
    const by = new Map<string, [number, number][]>();
    for (const u of utterances) {
      const spans = by.get(u.speaker_id) ?? [];
      const last = spans[spans.length - 1];
      if (last && u.start_ms - last[1] < 2000) last[1] = Math.max(last[1], u.end_ms);
      else spans.push([u.start_ms, u.end_ms]);
      by.set(u.speaker_id, spans);
    }
    return by;
  }, [utterances]);

  const talkTotal = speakers.reduce((t, s) => t + s.talk_ms, 0) || 1;
  const pct = (ms: number) => `${(ms / dur) * 100}%`;

  const seekFromLane = (e: MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    store.seek(((e.clientX - r.left) / r.width) * dur);
  };

  return (
    <section className="tl" aria-label="Speaker timeline">
      <div className="tl-top">
        <h3>Who spoke when</h3>
        <span>Click a lane to jump, a name to filter</span>
      </div>
      <div className="tl-grid">
        <div className="chaprow" style={{ gridRow: 1 }}>
          {chapters.map((c, i) => (
            <button
              key={c.id}
              className="chaptick"
              style={{ left: pct(c.start_ms) }}
              title={`${c.title} · ${clock(c.start_ms)}`}
              onClick={() => store.seek(c.start_ms)}
            >
              {i + 1}
            </button>
          ))}
        </div>
        {speakers.map((s, i) => (
          <LaneRow
            key={s.id}
            s={s}
            row={i}
            spans={lanes.get(s.id) ?? []}
            pct={pct}
            share={s.talk_ms / talkTotal}
            off={hidden.has(s.id)}
            onToggle={() => onToggleSpeaker(s.id)}
            onSeek={seekFromLane}
          />
        ))}
        <div className="tl-overlay" style={{ gridRow: `2 / span ${speakers.length}`, gridColumn: 2 }}>
          {highlights.map((h) => (
            <i
              key={h.id}
              className="clipmark"
              style={{ left: pct(h.start_ms), width: pct(h.end_ms - h.start_ms) }}
            />
          ))}
          <Playhead dur={dur} />
        </div>
        <div className="axis mono" style={{ gridRow: speakers.length + 2 }}>
          <span>0:00</span>
          <span>{clock(dur / 4)}</span>
          <span>{clock(dur / 2)}</span>
          <span>{clock((dur * 3) / 4)}</span>
          <span>{clock(dur)}</span>
        </div>
      </div>
    </section>
  );
}

function LaneRow({
  s,
  row,
  spans,
  pct,
  share,
  off,
  onToggle,
  onSeek,
}: {
  s: Speaker;
  row: number;
  spans: [number, number][];
  pct: (ms: number) => string;
  share: number;
  off: boolean;
  onToggle: () => void;
  onSeek: (e: MouseEvent<HTMLDivElement>) => void;
}) {
  const style = { "--c": speakerColor(s.color), gridRow: row + 2, gridColumn: 2 } as CSSProperties;
  return (
    <>
      <button
        className={`tl-name${off ? " off" : ""}`}
        style={{ gridRow: row + 2, gridColumn: 1 }}
        onClick={onToggle}
        title={off ? `Show ${s.name}` : `Hide ${s.name} in the transcript`}
        aria-pressed={!off}
      >
        {s.name}
      </button>
      <div className={`lane${off ? " off" : ""}`} style={style} onClick={onSeek}>
        {spans.map(([a, b]) => (
          <i key={a} className="seg" style={{ left: pct(a), width: pct(b - a) }} />
        ))}
      </div>
      <span className="tl-pct mono" style={{ gridRow: row + 2, gridColumn: 3 }}>
        {Math.round(share * 100)}%
      </span>
    </>
  );
}

function Playhead({ dur }: { dur: number }) {
  const ms = usePlayerState((s) => Math.round(s.ms / 250) * 250);
  return <i className="playhead" style={{ left: `${Math.min(100, (ms / dur) * 100)}%` }} />;
}
