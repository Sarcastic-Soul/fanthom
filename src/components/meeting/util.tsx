import { Fragment, type ReactNode } from "react";
import { clock } from "@/lib/format";
import type { SummaryBullet, SummaryContent, Utterance } from "@/lib/types";

// Gemini sometimes wraps key words in **bold**. Render that, nothing else.
export function richText(text: string): ReactNode {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return parts.map((p, i) => (i % 2 ? <b key={i}>{p}</b> : <Fragment key={i}>{p}</Fragment>));
}

export function bulletMs(b: SummaryBullet, utterances: Utterance[]): number | null {
  if (typeof b.ts_ms === "number") return b.ts_ms;
  if (typeof b.line === "number") return utterances[b.line]?.start_ms ?? null;
  return null;
}

export function summaryAsText(title: string, content: SummaryContent | undefined, utterances: Utterance[]) {
  if (!content) return title;
  const out = [title, ""];
  if (content.tldr) out.push(content.tldr, "");
  for (const s of content.sections) {
    out.push(s.heading);
    for (const b of s.bullets) {
      const ms = bulletMs(b, utterances);
      out.push(`- ${b.text.replace(/\*\*/g, "")}${ms != null ? ` (${clock(ms)})` : ""}`);
    }
    out.push("");
  }
  return out.join("\n").trim();
}

// Highlights every case-insensitive occurrence of `q` in `text`.
export function markMatches(text: string, q: string): ReactNode {
  if (!q) return text;
  const lower = text.toLowerCase();
  const needle = q.toLowerCase();
  const out: ReactNode[] = [];
  let from = 0;
  for (;;) {
    const at = lower.indexOf(needle, from);
    if (at < 0) break;
    out.push(text.slice(from, at), <mark key={at}>{text.slice(at, at + q.length)}</mark>);
    from = at + q.length;
  }
  out.push(text.slice(from));
  return out;
}
