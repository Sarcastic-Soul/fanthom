"use client";

import Link from "next/link";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="share">
      <Link href="/" className="brand">
        Fanth<i>o</i>m
      </Link>
      <h1 className="quote" style={{ marginTop: 40 }}>
        This page could not load.
      </h1>
      <p className="muted" style={{ maxWidth: "52ch" }}>
        The database did not answer in time. Your link is fine; trying again usually works.
      </p>
      <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
        <button className="btn primary" onClick={reset}>
          Try again
        </button>
        <Link className="btn" href="/">
          Go to meetings
        </Link>
      </div>
    </div>
  );
}
