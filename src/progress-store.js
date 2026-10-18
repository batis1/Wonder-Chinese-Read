import { whenIdle } from "./resources.js";

// Playback progress is persistence data, not a reason to render the reader again.
export function createProgressStore(initial, persist, schedule = whenIdle) {
  let value = initial;
  let cancel;
  let dirty = false;
  const flush = () => {
    cancel?.();
    cancel = null;
    if (!dirty) return;
    persist(value);
    dirty = false;
  };
  return {
    get: () => value,
    set(update) {
      value = typeof update === "function" ? update(value) : update;
      dirty = true;
      cancel?.();
      cancel = schedule(flush);
    },
    flush,
  };
}
