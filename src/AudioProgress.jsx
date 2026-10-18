import React, { useSyncExternalStore } from "react";

const time = (seconds) =>
  `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;

export function AudioProgress({ clock, duration, disabled, onSeek }) {
  const seconds = useSyncExternalStore(clock.subscribe, clock.getSnapshot);
  return (
    <div className="audio-progress">
      <input
        aria-label="Audio progress"
        type="range"
        min="0"
        max={duration || 1}
        step="0.05"
        value={Math.min(seconds, duration || 1)}
        style={{
          "--audio-progress": `${Math.min(100, Math.max(0, (seconds / (duration || 1)) * 100))}%`,
        }}
        disabled={disabled}
        onChange={(event) => onSeek(Number(event.target.value))}
      />
    </div>
  );
}

export function AudioTime({ clock, duration }) {
  const seconds = useSyncExternalStore(clock.subscribe, clock.getWholeSeconds);
  return (
    <span className="audio-time">
      {time(seconds)} / {time(duration)}
    </span>
  );
}
