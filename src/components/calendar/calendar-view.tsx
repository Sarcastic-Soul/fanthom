"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle, Circle, CircleNotch, UploadSimple } from "@phosphor-icons/react";
import { SAMPLE_EVENTS } from "@/lib/calendar";
import { useStored } from "@/lib/use-stored";
import { WORKSPACE_TZ, shortDate, timeOfDay } from "@/lib/format";

const KEY = "fanthom:notetaker";
const STEPS = ["Upload the file", "Turn speech into text and tell speakers apart", "Write the summary, chapters and action items"];

export function CalendarView({ example }: { example: { slug: string; title: string } | null }) {
  const defaults = Object.fromEntries(SAMPLE_EVENTS.map((e) => [e.id, e.recordByDefault]));
  const [saved, setSaved] = useStored<Record<string, boolean>>(KEY, {});
  const on = { ...defaults, ...saved };
  const flip = (id: string) => setSaved({ ...saved, [id]: !on[id] });

  const count = Object.values(on).filter(Boolean).length;

  return (
    <>
      <h2 className="sec-h" style={{ marginTop: 36 }}>
        Coming up · <span className="muted">notetaker set to join {count} of {SAMPLE_EVENTS.length}</span>
      </h2>
      <ul className="cal">
        {SAMPLE_EVENTS.map((e) => (
          <li key={e.id}>
            <span className="mono" style={{ fontSize: 13 }}>
              {shortDate(e.startsAt)}
              <br />
              <span className="muted">{timeOfDay(e.startsAt)}</span>
            </span>
            <span>
              <span className="ev">{e.title}</span>
              <br />
              <span className="muted" style={{ fontSize: 13 }}>
                {e.minutes} min · {e.attendees} people
              </span>
            </span>
            <span className="muted">{e.platform}</span>
            <button
              className="toggle"
              role="switch"
              aria-checked={on[e.id]}
              onClick={() => flip(e.id)}
            >
              <span className="sw" />
              {on[e.id] ? "Notetaker joins" : "Not recording"}
            </button>
          </li>
        ))}
      </ul>
      <p className="muted" style={{ fontSize: 12.5, marginTop: 10 }}>
        Times shown in {WORKSPACE_TZ.replace("_", " ")}.
      </p>
      <Upload example={example} />
    </>
  );
}

function Upload({ example }: { example: { slug: string; title: string } | null }) {
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [step, setStep] = useState(-1);

  useEffect(() => {
    if (!file || step >= STEPS.length) return;
    const t = setTimeout(() => setStep((s) => s + 1), step < 0 ? 300 : 1100);
    return () => clearTimeout(t);
  }, [file, step]);

  const pick = (f: File | undefined) => {
    if (!f) return;
    setFile(f);
    setStep(-1);
  };

  return (
    <section id="upload" style={{ scrollMarginTop: 24 }}>
      <h2 className="sec-h" style={{ marginTop: 48 }}>
        Add a recording
      </h2>
      <div
        className="drop"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          pick(e.dataTransfer.files[0]);
        }}
      >
        <UploadSimple size={22} color="var(--ink-3)" />
        <div style={{ flex: 1, minWidth: 220 }}>
          <div>Drop an audio or video file here</div>
          <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>
            A walk-through only. The file never leaves your browser and nothing is processed.
          </div>
        </div>
        <button className="btn" onClick={() => input.current?.click()}>
          Choose a file
        </button>
        <input
          ref={input}
          type="file"
          accept="audio/*,video/*"
          hidden
          onChange={(e) => pick(e.target.files?.[0])}
        />
      </div>

      {file && (
        <div style={{ marginTop: 18, maxWidth: 820 }} aria-live="polite">
          <div style={{ fontSize: 14 }}>
            <b style={{ fontWeight: 500 }}>{file.name}</b>{" "}
            <span className="muted">· {(file.size / 1e6).toFixed(1)} MB</span>
          </div>
          <ol className="steps">
            {STEPS.map((s, i) => (
              <li key={s} className={i < step ? "ok" : i === step ? "on" : ""}>
                {i < step ? (
                  <CheckCircle size={16} weight="fill" color="var(--accent)" />
                ) : i === step ? (
                  <CircleNotch size={16} className="spin" />
                ) : (
                  <Circle size={16} />
                )}
                {s}
              </li>
            ))}
          </ol>
          {step >= STEPS.length && (
            <p className="muted" style={{ fontSize: 13.5, marginTop: 14 }}>
              That is the path a real upload takes. In this demo it stops here, because processing costs API
              credits.{" "}
              {example && (
                <Link href={`/meetings/${example.slug}`}>
                  See a meeting that went through it <ArrowRight size={12} />
                </Link>
              )}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
