// Only clock subscribers update on timeupdate; the reader and open panels stay idle.
export function createMediaClock() {
  let seconds = 0;
  const listeners = new Set();
  return {
    getSnapshot: () => seconds,
    getWholeSeconds: () => Math.floor(seconds),
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    set(value) {
      const next = Number.isFinite(value) ? Math.max(0, value) : 0;
      if (next === seconds) return;
      seconds = next;
      for (const listener of listeners) listener();
    },
  };
}
