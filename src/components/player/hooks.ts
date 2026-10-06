"use client";

import { usePlayerState } from "./context";

// Index of the last item whose start is at or before `ms`, or -1.
export function indexAt(starts: { start_ms: number }[], ms: number) {
  let lo = 0;
  let hi = starts.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (starts[mid].start_ms <= ms) {
      found = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return found;
}

// Re-renders only when the active item changes, not on every clock tick.
export function useActiveIndex(items: { start_ms: number }[]) {
  return usePlayerState((s) => indexAt(items, s.ms + 150));
}
