"use client";

import { useSyncExternalStore } from "react";

// One small store per page for playback state. Components subscribe to the
// slice they need, so the hour-long transcript does not re-render on every tick.

export type PlayerState = {
  ms: number;
  playing: boolean;
  ready: boolean;
  rate: number;
};

export type PlayerControls = {
  seek: (ms: number, play?: boolean) => void;
  play: () => void;
  pause: () => void;
  setRate: (rate: number) => void;
};

export function createPlayerStore() {
  let state: PlayerState = { ms: 0, playing: false, ready: false, rate: 1 };
  const listeners = new Set<() => void>();
  let controls: PlayerControls = {
    seek: () => {},
    play: () => {},
    pause: () => {},
    setRate: () => {},
  };
  // Seek requests made before the media is ready are replayed once it is.
  let pendingSeek: { ms: number; play: boolean } | null = null;

  return {
    get: () => state,
    set(patch: Partial<PlayerState>) {
      state = { ...state, ...patch };
      listeners.forEach((l) => l());
    },
    subscribe(l: () => void) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    attach(c: PlayerControls) {
      controls = c;
      if (pendingSeek) {
        c.seek(pendingSeek.ms, pendingSeek.play);
        pendingSeek = null;
      }
    },
    detach() {
      controls = { seek: () => {}, play: () => {}, pause: () => {}, setRate: () => {} };
    },
    seek(ms: number, play = true) {
      state = { ...state, ms };
      listeners.forEach((l) => l());
      if (!state.ready) pendingSeek = { ms, play };
      else controls.seek(ms, play);
    },
    play: () => controls.play(),
    pause: () => controls.pause(),
    setRate: (r: number) => controls.setRate(r),
  };
}

export type PlayerStore = ReturnType<typeof createPlayerStore>;

export function usePlayerSelector<T>(store: PlayerStore, select: (s: PlayerState) => T): T {
  return useSyncExternalStore(
    store.subscribe,
    () => select(store.get()),
    () => select(store.get()),
  );
}
