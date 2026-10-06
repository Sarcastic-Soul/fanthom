"use client";

import { useEffect, useRef } from "react";
import { usePlayer } from "./context";

type YTPlayer = {
  seekTo: (s: number, allowSeekAhead: boolean) => void;
  playVideo: () => void;
  pauseVideo: () => void;
  getCurrentTime: () => number;
  setPlaybackRate: (r: number) => void;
  destroy: () => void;
};

type YTNamespace = {
  Player: new (
    el: HTMLElement,
    opts: {
      videoId: string;
      playerVars?: Record<string, number | string>;
      events?: {
        onReady?: () => void;
        onStateChange?: (e: { data: number }) => void;
      };
    },
  ) => YTPlayer;
};

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<YTNamespace> | null = null;
function loadApi(): Promise<YTNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve(window.YT!);
    };
    const s = document.createElement("script");
    s.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(s);
  });
  return apiPromise;
}

// Plays a YouTube video through the official embed API and keeps the player store in sync.
export function YouTubeMedia({ videoId, className }: { videoId: string; className?: string }) {
  const store = usePlayer();
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let player: YTPlayer | null = null;
    let timer: ReturnType<typeof setInterval> | undefined;
    let cancelled = false;
    const mount = document.createElement("div");
    host.current?.appendChild(mount);

    loadApi().then((YT) => {
      if (cancelled) return;
      player = new YT.Player(mount, {
        videoId,
        playerVars: { rel: 0, modestbranding: 1, playsinline: 1 },
        events: {
          onReady: () => {
            store.set({ ready: true });
            store.attach({
              seek: (ms, play) => {
                player?.seekTo(ms / 1000, true);
                if (play) player?.playVideo();
              },
              play: () => player?.playVideo(),
              pause: () => player?.pauseVideo(),
              setRate: (rate) => {
                player?.setPlaybackRate(rate);
                store.set({ rate });
              },
            });
          },
          onStateChange: (e) => {
            // 1 = playing, 2 = paused, 0 = ended
            const playing = e.data === 1;
            store.set({ playing, ms: (player?.getCurrentTime() ?? 0) * 1000 });
            clearInterval(timer);
            if (playing) {
              timer = setInterval(() => {
                store.set({ ms: (player?.getCurrentTime() ?? 0) * 1000 });
              }, 200);
            }
          },
        },
      });
    });

    return () => {
      cancelled = true;
      clearInterval(timer);
      store.detach();
      store.set({ ready: false, playing: false });
      player?.destroy();
      mount.remove();
    };
  }, [store, videoId]);

  return <div ref={host} className={className} />;
}
