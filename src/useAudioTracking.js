import { useEffect } from "react";
import { findTimedToken, nextTimingBoundary } from "./reader-model";

export function useAudioTracking({
  audio,
  index,
  playing,
  enabled,
  follow,
  blocked,
  onSentence,
}) {
  useEffect(() => {
    if (!enabled || !index.timed.length) return;
    const media = audio.current;
    if (!media) return;
    let frame;
    let timer;
    let highlighted;
    let sentenceKey;
    let lastScroll = 0;
    let wasPlaying;
    const passage = document.querySelector(".passage");
    const events = ["timeupdate", "seeking", "seeked", "ratechange", "play", "playing", "pause", "ended"];
    const reducedMotion = matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const update = () => {
      clearTimeout(timer);
      cancelAnimationFrame(frame);
      const seconds = media.currentTime || 0;
      const isPlaying = !media.paused && !media.ended;
      const token = findTimedToken(index, seconds);
      const element = token
        ? document.getElementById(`word-${token.key}`)
        : null;
      if (element !== highlighted) {
        const now = performance.now();
        const rect =
          element && playing && follow && !blocked && now - lastScroll > 500
            ? element.getBoundingClientRect()
            : null;
        highlighted?.classList.remove("speaking");
        element?.classList.add("speaking");
        highlighted = element;
        if (rect && (rect.bottom > innerHeight - 150 || rect.top < 240)) {
          lastScroll = now;
          element.scrollIntoView({
            block: "center",
            behavior: reducedMotion ? "instant" : "smooth",
          });
        }
      }
      if (isPlaying !== wasPlaying) {
        passage?.classList.toggle("audio-playing", isPlaying);
        wasPlaying = isPlaying;
      }
      if (token && token.sentence.key !== sentenceKey) {
        sentenceKey = token.sentence.key;
        onSentence(sentenceKey);
      }
      if (playing && isPlaying && !document.hidden && media.readyState >= 3) {
        const boundary = nextTimingBoundary(index, seconds);
        if (boundary != null) {
          const delay = Math.max(
            8,
            ((boundary - seconds) * 1000) / (media.playbackRate || 1),
          );
          timer = setTimeout(() => {
            frame = requestAnimationFrame(update);
          }, delay);
        }
      }
    };
    const onVisibility = () => {
      if (document.hidden) {
        clearTimeout(timer);
        cancelAnimationFrame(frame);
      } else update();
    };
    for (const event of events)
      media.addEventListener(event, update);
    document.addEventListener("visibilitychange", onVisibility);
    update();
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(frame);
      for (const event of events)
        media.removeEventListener(event, update);
      document.removeEventListener("visibilitychange", onVisibility);
      highlighted?.classList.remove("speaking");
      passage?.classList.remove("audio-playing");
    };
  }, [audio, index, playing, enabled, follow, blocked, onSentence]);
}
