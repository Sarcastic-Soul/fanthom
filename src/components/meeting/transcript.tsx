"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  ArrowDown,
  BookmarkSimple,
  CaretDown,
  CaretUp,
  LinkSimple,
  MagnifyingGlass,
  Scissors,
} from "@phosphor-icons/react";
import { usePlayer } from "@/components/player/context";
import { useActiveIndex } from "@/components/player/hooks";
import { clock, speakerColor } from "@/lib/format";
import type { Chapter, Highlight, Speaker, Utterance } from "@/lib/types";
import { markMatches } from "./util";

type Row =
  | { kind: "chapter"; chapter: Chapter; n: number }
  | { kind: "line"; u: Utterance; i: number };

type Selection = { startIdx: number; endIdx: number; text: string; x: number; y: number };

export function Transcript({
  speakers,
  utterances,
  chapters,
  highlights,
  hidden,
  onToggleSpeaker,
  onShowAll,
  onCreateClip,
  onCopyMoment,
}: {
  speakers: Speaker[];
  utterances: Utterance[];
  chapters: Chapter[];
  highlights: Highlight[];
  hidden: Set<string>;
  onToggleSpeaker: (id: string) => void;
  onShowAll: () => void;
  onCreateClip: (sel: { startMs: number; endMs: number; quote: string }) => Promise<void>;
  onCopyMoment: (ms: number) => void;
}) {
  const store = usePlayer();
  const listRef = useRef<HTMLDivElement>(null);
  const [q, setQ] = useState("");
  const [hit, setHit] = useState(0);
  const [follow, setFollow] = useState(true);
  const [sel, setSel] = useState<Selection | null>(null);
  const [saving, setSaving] = useState(false);
  const speakerById = useMemo(() => new Map(speakers.map((s) => [s.id, s])), [speakers]);

  // Transcript rows: lines from visible speakers, with a heading where each chapter starts.
  const rows = useMemo(() => {
    const out: Row[] = [];
    let c = 0;
    utterances.forEach((u, i) => {
      while (c < chapters.length && chapters[c].start_ms <= u.start_ms + 500) {
        out.push({ kind: "chapter", chapter: chapters[c], n: c + 1 });
        c++;
      }
      if (!hidden.has(u.speaker_id)) out.push({ kind: "line", u, i });
    });
    return out;
  }, [utterances, chapters, hidden]);

  const rowOfLine = useMemo(() => {
    const m = new Map<number, number>();
    rows.forEach((r, ri) => r.kind === "line" && m.set(r.i, ri));
    return m;
  }, [rows]);

  const savedLines = useMemo(() => {
    const set = new Set<number>();
    for (const h of highlights) {
      for (const u of utterances) {
        if (u.start_ms < h.end_ms && u.end_ms > h.start_ms) set.add(u.idx);
      }
    }
    return set;
  }, [highlights, utterances]);

  const needle = q.trim().toLowerCase();
  const matches = useMemo(() => {
    if (needle.length < 2) return [];
    return rows.flatMap((r, ri) => (r.kind === "line" && r.u.text.toLowerCase().includes(needle) ? [ri] : []));
  }, [rows, needle]);

  const virt = useVirtualizer({
    count: rows.length,
    getScrollElement: () => listRef.current,
    estimateSize: (i) => (rows[i].kind === "chapter" ? 44 : 72),
    overscan: 12,
  });

  const active = useActiveIndex(utterances);
  const activeRow = active >= 0 ? rowOfLine.get(active) : undefined;

  // Keep the current line in view while playing, until the reader scrolls away.
  useEffect(() => {
    if (!follow || activeRow === undefined || needle) return;
    virt.scrollToIndex(activeRow, { align: "center", behavior: "auto" });
  }, [activeRow, follow, needle, virt]);

  useEffect(() => {
    if (matches.length) virt.scrollToIndex(matches[Math.min(hit, matches.length - 1)], { align: "center" });
  }, [hit, matches, virt]);

  const stopFollowing = useCallback(() => setFollow(false), []);

  const onMouseUp = useCallback(() => {
    const s = window.getSelection();
    if (!s || s.isCollapsed || !listRef.current) return setSel(null);
    const text = s.toString().trim();
    const a = (s.anchorNode?.parentElement as HTMLElement | null)?.closest<HTMLElement>("[data-line]");
    const b = (s.focusNode?.parentElement as HTMLElement | null)?.closest<HTMLElement>("[data-line]");
    if (!text || !a || !b || !listRef.current.contains(a)) return setSel(null);
    const ia = Number(a.dataset.line);
    const ib = Number(b.dataset.line);
    const rect = s.getRangeAt(0).getBoundingClientRect();
    setSel({
      startIdx: Math.min(ia, ib),
      endIdx: Math.max(ia, ib),
      text,
      x: rect.left + rect.width / 2,
      y: rect.top,
    });
  }, []);

  useEffect(() => {
    const clear = () => setSel(null);
    const el = listRef.current;
    el?.addEventListener("scroll", clear, { passive: true });
    return () => el?.removeEventListener("scroll", clear);
  }, []);

  const selStart = sel ? utterances[sel.startIdx]?.start_ms : 0;
  const selEnd = sel ? utterances[sel.endIdx]?.end_ms : 0;

  return (
    <section className="tx" aria-label="Transcript">
      <div className="tx-tools">
        <label className="search">
          <MagnifyingGlass size={15} color="var(--ink-3)" />
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setHit(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && matches.length) setHit((h) => (h + (e.shiftKey ? -1 : 1) + matches.length) % matches.length);
              if (e.key === "Escape") setQ("");
            }}
            placeholder="Search this meeting"
            autoComplete="off"
            aria-label="Search this meeting"
          />
          {needle.length >= 2 && (
            <span className="hits mono">
              {matches.length ? `${Math.min(hit, matches.length - 1) + 1} of ${matches.length}` : "no matches"}
              {matches.length > 1 && (
                <>
                  <button aria-label="Previous match" onClick={() => setHit((h) => (h - 1 + matches.length) % matches.length)}>
                    <CaretUp size={13} />
                  </button>
                  <button aria-label="Next match" onClick={() => setHit((h) => (h + 1) % matches.length)}>
                    <CaretDown size={13} />
                  </button>
                </>
              )}
            </span>
          )}
        </label>
        <div className="chips">
          <span className="lbl">Speakers</span>
          {speakers.map((s) => (
            <button
              key={s.id}
              className={`chip${hidden.has(s.id) ? " off" : ""}`}
              style={{ "--c": speakerColor(s.color) } as CSSProperties}
              onClick={() => onToggleSpeaker(s.id)}
              aria-pressed={!hidden.has(s.id)}
            >
              <i className="dot" />
              {s.name}
            </button>
          ))}
          {hidden.size > 0 && (
            <button className="chip" onClick={onShowAll} style={{ color: "var(--accent)" }}>
              Show everyone
            </button>
          )}
        </div>
      </div>

      <div
        className="tx-list"
        ref={listRef}
        onWheel={stopFollowing}
        onTouchMove={stopFollowing}
        onMouseUp={onMouseUp}
      >
        {rows.length === 0 && <p className="empty-note">Nobody is selected. Pick a speaker above.</p>}
        <div style={{ height: virt.getTotalSize(), position: "relative" }}>
          {virt.getVirtualItems().map((v) => {
            const r = rows[v.index];
            const style: CSSProperties = {
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              transform: `translateY(${v.start}px)`,
            };
            if (r.kind === "chapter") {
              return (
                <div key={v.key} ref={virt.measureElement} data-index={v.index} style={style} className="chapter-break">
                  <span>§ {r.n}</span>
                  {r.chapter.title}
                </div>
              );
            }
            const s = speakerById.get(r.u.speaker_id);
            const now = r.i === active;
            const saved = savedLines.has(r.u.idx);
            return (
              <div
                key={v.key}
                ref={virt.measureElement}
                data-index={v.index}
                data-line={r.i}
                style={{ ...style, "--c": speakerColor(s?.color ?? 0) } as CSSProperties}
                className={`line${now ? " now" : ""}${saved ? " saved" : ""}`}
                onClick={() => {
                  if (window.getSelection()?.isCollapsed === false) return;
                  store.seek(r.u.start_ms);
                  setFollow(true);
                }}
              >
                <span className="t">{clock(r.u.start_ms)}</span>
                <div>
                  <div className="who">
                    <i className="dot" />
                    {s?.name}
                    {saved && (
                      <span className="tag">
                        <BookmarkSimple size={12} weight="fill" /> In a clip
                      </span>
                    )}
                  </div>
                  <div className="say">{needle.length >= 2 ? markMatches(r.u.text, q.trim()) : r.u.text}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {!follow && activeRow !== undefined && (
        <button
          className="btn follow"
          onClick={() => {
            setFollow(true);
            virt.scrollToIndex(activeRow, { align: "center" });
          }}
        >
          <ArrowDown size={14} /> Back to {clock(utterances[active].start_ms)}
        </button>
      )}

      {sel && (
        <div className="pop" style={{ left: sel.x, top: sel.y }} onMouseDown={(e) => e.preventDefault()}>
          <button
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              await onCreateClip({ startMs: selStart, endMs: selEnd, quote: sel.text });
              setSaving(false);
              setSel(null);
              window.getSelection()?.removeAllRanges();
            }}
          >
            <Scissors size={14} /> {saving ? "Saving…" : "Create clip"}
          </button>
          <button
            onClick={() => {
              onCopyMoment(selStart);
              setSel(null);
            }}
          >
            <LinkSimple size={14} /> Copy link
          </button>
          <span>
            {clock(selStart)}–{clock(selEnd)}
          </span>
        </div>
      )}
    </section>
  );
}
