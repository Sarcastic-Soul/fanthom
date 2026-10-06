"use client";

import { useState } from "react";

export function CopyLink({ path, label = "Copy link" }: { path: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      className="ts"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(window.location.origin + path);
          setDone(true);
          setTimeout(() => setDone(false), 1800);
        } catch {}
      }}
    >
      {done ? "Copied" : label}
    </button>
  );
}
