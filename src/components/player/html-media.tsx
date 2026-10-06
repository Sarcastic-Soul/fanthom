"use client";

import { useEffect, useRef } from "react";
import { usePlayer } from "./context";

// Plays an audio or video file and keeps the player store in sync with it.
export function HtmlMedia({
  src,
  kind,
  className,
  poster,
}: {
  src: string;
  kind: "audio" | "video";
  className?: string;
  poster?: string;
}) {
  const store = usePlayer();
  const ref = useRef<HTMLVideoElement & HTMLAudioElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let frame = 0;
    const tick = () => {
      store.set({ ms: el.currentTime * 1000 });
      if (!el.paused) frame = requestAnimationFrame(tick);
    };
    const onPlay = () => {
      store.set({ playing: true });
      frame = requestAnimationFrame(tick);
    };
    const onPause = () => {
      cancelAnimationFrame(frame);
      store.set({ playing: false, ms: el.currentTime * 1000 });
    };
    const onSeeked = () => store.set({ ms: el.currentTime * 1000 });
    const onReady = () => {
      store.set({ ready: true });
      store.attach({
        seek: (ms, play) => {
          el.currentTime = ms / 1000;
          if (play) void el.play().catch(() => {});
        },
        play: () => void el.play().catch(() => {}),
        pause: () => el.pause(),
        setRate: (rate) => {
          el.playbackRate = rate;
          store.set({ rate });
        },
      });
    };
    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);
    el.addEventListener("ended", onPause);
    el.addEventListener("seeked", onSeeked);
    if (el.readyState >= 1) onReady();
    else el.addEventListener("loadedmetadata", onReady, { once: true });
    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
      el.removeEventListener("ended", onPause);
      el.removeEventListener("seeked", onSeeked);
      el.removeEventListener("loadedmetadata", onReady);
      store.detach();
      store.set({ ready: false, playing: false });
    };
  }, [store, src]);

  if (kind === "video") {
    return <video ref={ref} src={src} poster={poster} preload="metadata" playsInline className={className} />;
  }
  return <audio ref={ref} src={src} preload="metadata" className="hidden" />;
}
