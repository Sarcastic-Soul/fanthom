"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";
import { CaretRight, Copy, Info, LinkSimple, Play, ShareNetwork } from "@phosphor-icons/react";
import { createClip } from "@/app/actions";
import { Faces } from "@/components/faces";
import { PlayerProvider, usePlayer } from "@/components/player/context";
import { useActiveIndex } from "@/components/player/hooks";
import { clock, minutes, shortDate, speakerColor, timeOfDay } from "@/lib/format";
import { TEMPLATES, type ActionItem, type Highlight, type MeetingDetail, type Speaker } from "@/lib/types";
import { PlayerBox, Timeline } from "./side";
import { ToastProvider, copyText, useToast } from "./toast";
import { Transcript } from "./transcript";
import { bulletMs, richText, summaryAsText } from "./util";

export function MeetingView(props: { data: MeetingDetail }) {
  return (
    <PlayerProvider>
      <ToastProvider>
        <MeetingInner {...props} />
      </ToastProvider>
    </PlayerProvider>
  );
}

function MeetingInner({ data }: { data: MeetingDetail }) {
  const { meeting, speakers, utterances, chapters, actionItems, summaries } = data;
  const store = usePlayer();
  const toast = useToast();
  const [tab, setTab] = useState<"minutes" | "transcript">("minutes");
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [highlights, setHighlights] = useState<Highlight[]>(data.highlights);

  const defaultTemplate =
    summaries.find((s) => s.template === meeting.meeting_type)?.template ?? summaries[0]?.template ?? "general";
  const [template, setTemplate] = useState(defaultTemplate);
  const summary = summaries.find((s) => s.template === template);

  const speakerById = useMemo(() => new Map(speakers.map((s) => [s.id, s])), [speakers]);
  const speakerByName = useMemo(() => new Map(speakers.map((s) => [s.name.toLowerCase(), s])), [speakers]);

  // A shared link can point at a moment: /meetings/x?t=754 starts there.
  useEffect(() => {
    const t = Number(new URLSearchParams(window.location.search).get("t"));
    if (t > 0) store.seek(t * 1000, false);
  }, [store]);

  // Space plays and pauses, arrows skip five seconds, unless the reader is typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest("input, textarea, select, [contenteditable]")) return;
      const st = store.get();
      if (e.key === " " && !el.closest("button, a")) {
        e.preventDefault();
        if (st.playing) store.pause();
        else store.play();
      } else if (e.key === "ArrowRight") store.seek(st.ms + 5000, st.playing);
      else if (e.key === "ArrowLeft") store.seek(Math.max(0, st.ms - 5000), st.playing);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [store]);

  const toggleSpeaker = useCallback((id: string) => {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const momentUrl = (ms: number) =>
    `${window.location.origin}/meetings/${meeting.slug}?t=${Math.floor(ms / 1000)}`;

  const copyMoment = async (ms: number) => {
    const ok = await copyText(momentUrl(ms));
    toast(ok ? `Link to ${clock(ms)} copied` : "Could not copy the link");
  };

  const onCreateClip = async ({ startMs, endMs, quote }: { startMs: number; endMs: number; quote: string }) => {
    const res = await createClip({ meetingId: meeting.id, startMs, endMs, quote });
    if ("error" in res) {
      toast(res.error);
      return;
    }
    setHighlights((h) =>
      [
        ...h,
        {
          id: res.id,
          meeting_id: meeting.id,
          start_ms: startMs,
          end_ms: endMs,
          quote,
          title: null,
          created_at: new Date().toISOString(),
        },
      ].sort((a, b) => a.start_ms - b.start_ms),
    );
    const url = `${window.location.origin}/share/clip/${res.id}`;
    const copied = await copyText(url);
    toast(
      <>
        Clip saved{copied ? ", link copied" : ""}.{" "}
        <a href={url} target="_blank" rel="noreferrer">
          Open it
        </a>
      </>,
    );
  };

  const people = speakers.map((s) => ({ name: s.name, color: s.color }));
  const end = new Date(new Date(meeting.started_at).getTime() + meeting.duration_ms).toISOString();

  return (
    <div className="cols" data-tab={tab}>
      <header className="head">
        <div className="crumb">
          <Link href="/">Meetings</Link>
          <CaretRight size={11} />
          <span>{meeting.source_name}</span>
        </div>
        <h1 className="title">{meeting.title}</h1>
        <div className="meta">
          <span>{shortDate(meeting.started_at)}</span>
          <span className="sep" />
          <span className="mono">
            {timeOfDay(meeting.started_at)}–{timeOfDay(end)}
          </span>
          <span className="sep" />
          <span>{minutes(meeting.duration_ms)}</span>
          <span className="sep" />
          <Faces people={people} />
          <span>{speakers.length} people</span>
        </div>
        <div className="actions">
          <button
            className="btn primary"
            onClick={async () => {
              const ok = await copyText(`${window.location.origin}/meetings/${meeting.slug}`);
              toast(ok ? "Meeting link copied. Anyone with it can watch, no sign-in." : "Could not copy the link");
            }}
          >
            <ShareNetwork size={15} />
            Share
          </button>
          <button
            className="btn"
            onClick={async () => {
              const ok = await copyText(summaryAsText(meeting.title, summary?.content, utterances));
              toast(ok ? "Summary copied as plain text" : "Could not copy");
            }}
          >
            <Copy size={15} />
            Copy summary
          </button>
          <span className="stubnote">
            <Info size={15} style={{ flex: "none" }} />
            Written by AI from the transcript. Every point links to the moment it came from.
          </span>
        </div>
      </header>

      <nav className="mtabs" aria-label="View">
        <button className={tab === "minutes" ? "on" : undefined} onClick={() => setTab("minutes")}>
          Summary
        </button>
        <button className={tab === "transcript" ? "on" : undefined} onClick={() => setTab("transcript")}>
          Transcript
        </button>
      </nav>

      <article className="doc">
        <div className="tpl" role="tablist" aria-label="Summary template">
          <span className="lbl">Template:</span>
          {TEMPLATES.filter((t) => summaries.some((s) => s.template === t.id)).map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={template === t.id}
              className={template === t.id ? "on" : undefined}
              onClick={() => setTemplate(t.id)}
            >
              {t.label}
              {t.id === meeting.meeting_type && <span className="suggest">best fit</span>}
            </button>
          ))}
        </div>

        {summary ? (
          <>
            {summary.content.tldr && <p className="lede">{richText(summary.content.tldr)}</p>}
            {summary.model && <div className="byline">Summary by {modelName(summary.model)}</div>}
            {summary.content.sections.map((sec, i) => (
              <section className="sec" key={sec.heading + i}>
                <div className="sec-n">{i + 1}.</div>
                <div>
                  <h2>{sec.heading}</h2>
                  <ul className="pts">
                    {sec.bullets.map((b, j) => {
                      const ms = bulletMs(b, utterances);
                      return (
                        <li key={j}>
                          <span>{richText(b.text)}</span>
                          {ms != null ? (
                            <button className="ts" onClick={() => store.seek(ms)} aria-label={`Play from ${clock(ms)}`}>
                              {clock(ms)}
                            </button>
                          ) : (
                            <span />
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </section>
            ))}
          </>
        ) : (
          <p className="lede">No summary for this template yet.</p>
        )}

        <ActionItems
          n={(summary?.content.sections.length ?? 0) + 1}
          meetingId={meeting.id}
          items={actionItems}
          speakerById={speakerById}
          speakerByName={speakerByName}
        />

        <Chapters n={(summary?.content.sections.length ?? 0) + 2} data={data} />

        <section className="sec">
          <div className="sec-n">{(summary?.content.sections.length ?? 0) + 3}.</div>
          <div>
            <h2>
              Clips<small>Select lines in the transcript to make one</small>
            </h2>
            {highlights.length === 0 ? (
              <p className="muted" style={{ fontSize: 14, margin: "8px 0 0" }}>
                No clips yet. Select a few lines in the transcript, then press Create clip. You get a link that
                plays just that part, for someone who was not on the call.
              </p>
            ) : (
              <ul className="clips">
                {highlights.map((h) => (
                  <li key={h.id} className="clip-row">
                    <div>
                      <q>{h.quote.length > 220 ? h.quote.slice(0, 220) + "…" : h.quote}</q>
                      <div className="muted mono" style={{ fontSize: 12, marginTop: 4 }}>
                        {clock(h.start_ms)}–{clock(h.end_ms)}
                      </div>
                    </div>
                    <div className="acts">
                      <button className="ts" onClick={() => store.seek(h.start_ms)}>
                        <Play size={12} weight="fill" /> Play
                      </button>
                      <button
                        className="ts"
                        onClick={async () => {
                          const ok = await copyText(`${window.location.origin}/share/clip/${h.id}`);
                          toast(ok ? "Clip link copied" : "Could not copy");
                        }}
                      >
                        <LinkSimple size={12} /> Link
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <p className="colophon">
          {meeting.credit}
          {meeting.source_url && (
            <>
              {" "}
              <a href={meeting.source_url} target="_blank" rel="noreferrer">
                Original recording
              </a>
              .
            </>
          )}{" "}
          Transcribed, summarised and split into chapters ahead of time when this demo was built, so it plays the
          same for every visitor.
        </p>
      </article>

      <aside className="side">
        <PlayerBox meeting={meeting} speakers={speakers} utterances={utterances} speakerById={speakerById} />
        <Timeline
          speakers={speakers}
          utterances={utterances}
          chapters={chapters}
          highlights={highlights}
          durationMs={meeting.duration_ms}
          hidden={hidden}
          onToggleSpeaker={toggleSpeaker}
        />
        <Transcript
          speakers={speakers}
          utterances={utterances}
          chapters={chapters}
          highlights={highlights}
          hidden={hidden}
          onToggleSpeaker={toggleSpeaker}
          onShowAll={() => setHidden(new Set())}
          onCreateClip={onCreateClip}
          onCopyMoment={copyMoment}
        />
      </aside>
    </div>
  );
}

function modelName(id: string) {
  return id.replace(/^models\//, "").replace(/^gemini/, "Gemini").replace(/-/g, " ");
}

function ActionItems({
  n,
  meetingId,
  items,
  speakerById,
  speakerByName,
}: {
  n: number;
  meetingId: string;
  items: ActionItem[];
  speakerById: Map<string, Speaker>;
  speakerByName: Map<string, Speaker>;
}) {
  const store = usePlayer();
  const key = `fanthom:done:${meetingId}`;
  // Ticks are kept in this browser only, so one visitor cannot change the demo for the next.
  const [done, setDone] = useState<Set<string>>(new Set());
  useEffect(() => {
    try {
      setDone(new Set(JSON.parse(localStorage.getItem(key) ?? "[]")));
    } catch {}
  }, [key]);
  const toggle = (id: string) => {
    setDone((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try {
        localStorage.setItem(key, JSON.stringify([...next]));
      } catch {}
      return next;
    });
  };

  return (
    <section className="sec">
      <div className="sec-n">{n}.</div>
      <div>
        <h2>
          Action items
          <small>
            {done.size} of {items.length} done
          </small>
        </h2>
        <div className="items-head">
          <span />
          <span>Task</span>
          <span>Owner</span>
          <span />
        </div>
        <ul className="items">
          {items.map((it) => {
            const owner =
              (it.speaker_id && speakerById.get(it.speaker_id)) ||
              (it.owner_name ? speakerByName.get(it.owner_name.toLowerCase()) : undefined);
            const isDone = done.has(it.id);
            return (
              <li key={it.id} className={`item${isDone ? " done" : ""}`}>
                <button
                  className="check"
                  role="checkbox"
                  aria-checked={isDone}
                  aria-label={`Mark "${it.text}" as ${isDone ? "not done" : "done"}`}
                  onClick={() => toggle(it.id)}
                />
                <span className="txt">{richText(it.text)}</span>
                <span className="owner" style={{ "--c": speakerColor(owner?.color ?? 0) } as CSSProperties}>
                  {owner ? <i className="dot" /> : null}
                  <span>{owner?.name ?? it.owner_name ?? "Unassigned"}</span>
                </span>
                {it.ts_ms != null ? (
                  <button className="ts" onClick={() => store.seek(it.ts_ms!)}>
                    {clock(it.ts_ms)}
                  </button>
                ) : (
                  <span />
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

function Chapters({ n, data }: { n: number; data: MeetingDetail }) {
  const { chapters, utterances, speakers } = data;
  const store = usePlayer();
  const current = useActiveIndex(chapters);

  // Who talked in each chapter, as a thin bar.
  const mixes = useMemo(
    () =>
      chapters.map((c) => {
        const by = new Map<string, number>();
        let total = 0;
        for (const u of utterances) {
          if (u.start_ms >= c.start_ms && u.start_ms < c.end_ms) {
            const d = u.end_ms - u.start_ms;
            by.set(u.speaker_id, (by.get(u.speaker_id) ?? 0) + d);
            total += d;
          }
        }
        return speakers
          .filter((s) => by.get(s.id))
          .map((s) => ({ s, share: (by.get(s.id) ?? 0) / (total || 1) }));
      }),
    [chapters, utterances, speakers],
  );

  return (
    <section className="sec">
      <div className="sec-n">{n}.</div>
      <div>
        <h2>Chapters</h2>
        <ol className="chaps">
          {chapters.map((c, i) => (
            <li key={c.id}>
              <button className={`chap${i === current ? " now" : ""}`} onClick={() => store.seek(c.start_ms)}>
                <span className="ts" style={{ textAlign: "left" }}>
                  {clock(c.start_ms)}
                </span>
                <span>
                  <span className="ct">{c.title}</span>
                  {c.gist && <span className="cd" style={{ display: "block" }}>{c.gist}</span>}
                </span>
                <span className="mix" title="Who talked in this chapter">
                  {mixes[i].map(({ s, share }) => (
                    <i key={s.id} style={{ width: `${share * 100}%`, "--c": speakerColor(s.color) } as CSSProperties} />
                  ))}
                </span>
              </button>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
