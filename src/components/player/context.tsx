"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { createPlayerStore, usePlayerSelector, type PlayerState, type PlayerStore } from "./store";

const PlayerContext = createContext<PlayerStore | null>(null);

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [store] = useState(createPlayerStore);
  return <PlayerContext.Provider value={store}>{children}</PlayerContext.Provider>;
}

export function usePlayer() {
  const store = useContext(PlayerContext);
  if (!store) throw new Error("usePlayer must be used inside PlayerProvider");
  return store;
}

export function usePlayerState<T>(select: (s: PlayerState) => T): T {
  return usePlayerSelector(usePlayer(), select);
}
