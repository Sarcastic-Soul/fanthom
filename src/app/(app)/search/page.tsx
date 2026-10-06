import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { MagnifyingGlass } from "@phosphor-icons/react/dist/ssr";
import { searchAll } from "@/lib/data";
import { clock, shortDate, speakerColor } from "@/lib/format";
import type { SearchHit } from "@/lib/types";

export const metadata: Metadata = { title: "Search" };

const TRIES = ["customers", "feedback", "pricing", "release", "battery", "milestone", "merge request"];

export default async function SearchPage({ searchParams }: PageProps<"/search">) {
  const { q: raw } = await searchParams;
  const q = (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? "";
  const hits = q ? await searchAll(q) : [];

  const groups = new Map<string, SearchHit[]>();
  for (const h of hits) groups.set(h.meeting_id, [...(groups.get(h.meeting_id) ?? []), h]);

  return (
    <div className="page">
      <h1 className="page-title">Search</h1>
      <p className="muted" style={{ margin: 0 }}>
        Every word said in every meeting. Results jump straight to the moment.
      </p>
      <form className="bigsearch" action="/search" role="search">
        <MagnifyingGlass size={24} color="var(--ink-3)" />
        <input name="q" defaultValue={q} placeholder="What was said about…" autoFocus={!q} aria-label="Search all meetings" />
        <button className="btn" type="submit">
          Search
        </button>
      </form>
      <div className="tries">
        <span>Try</span>
        {TRIES.map((t) => (
          <Link key={t} href={`/search?q=${encodeURIComponent(t)}`}>
            {t}
          </Link>
        ))}
        <span>or a phrase in quotes, or a -word to leave out.</span>
      </div>

      {q && (
        <p className="muted" style={{ marginTop: 28, fontSize: 13 }}>
          {hits.length === 0
            ? `Nothing found for “${q}”. Try a shorter or more common word.`
            : `${hits.length}${hits.length === 60 ? "+" : ""} moments in ${groups.size} meeting${groups.size === 1 ? "" : "s"}`}
        </p>
      )}

      {[...groups.values()].map((list) => (
        <section className="hitgroup" key={list[0].meeting_id}>
          <h3>
            <Link href={`/meetings/${list[0].meeting_slug}`}>{list[0].meeting_title}</Link>
            <span>
              {shortDate(list[0].started_at)} · {list.length} match{list.length === 1 ? "" : "es"}
            </span>
          </h3>
          <div style={{ marginTop: 8, borderTop: "1px solid var(--rule-2)" }}>
            {list
              .sort((a, b) => a.start_ms - b.start_ms)
              .map((h) => (
                <Link
                  key={h.utterance_id}
                  className="hit"
                  href={`/meetings/${h.meeting_slug}?t=${Math.floor(h.start_ms / 1000)}`}
                >
                  <span className="ts">{clock(h.start_ms)}</span>
                  <span className="owner" style={{ "--c": speakerColor(h.speaker_color) } as CSSProperties}>
                    <i className="dot" />
                    <span>{h.speaker_name}</span>
                  </span>
                  <span dangerouslySetInnerHTML={{ __html: safeSnippet(h.snippet) }} />
                </Link>
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}

// ts_headline returns raw transcript text with <mark> tags added. Escape
// everything, then put back only the mark tags.
function safeSnippet(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/&lt;mark&gt;/g, "<mark>")
    .replace(/&lt;\/mark&gt;/g, "</mark>");
}
