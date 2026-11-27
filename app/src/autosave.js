// Autosave timing. Pure logic with no DOM, so it can be unit-tested (autosave.test.js).
//
// Autosave waits for a pause in typing (the delay the user chose). A long delay must not let continuous typing go
// unsaved forever, so a file is also saved once it has been dirty for the maximum wait, whatever the pause.

export const AUTOSAVE_DELAYS = [3, 10, 30, 60];     // seconds the user can choose
export const AUTOSAVE_DEFAULT = 10;
export const AUTOSAVE_MAX_WAIT = 120;               // seconds of continuous typing after which a save happens anyway

/** The stored delay in seconds, or the default for a missing or unknown value. */
export function normalizeDelay(v) {
  const n = Number(v);
  return AUTOSAVE_DELAYS.includes(n) ? n : AUTOSAVE_DEFAULT;
}

/** Milliseconds to wait before saving: the pause the user chose, cut short so a save happens at most
 *  AUTOSAVE_MAX_WAIT seconds after the file first became unsaved (firstDirtyMs, a time in ms). */
export function autosaveWaitMs(delaySeconds, firstDirtyMs, nowMs, maxSeconds = AUTOSAVE_MAX_WAIT) {
  const pause = normalizeDelay(delaySeconds) * 1000;
  if (!Number.isFinite(firstDirtyMs) || firstDirtyMs <= 0) return pause;
  const left = maxSeconds * 1000 - (nowMs - firstDirtyMs);
  return Math.max(0, Math.min(pause, left));
}

/** "10 seconds", "1 minute" for the settings row. */
export function delayLabel(seconds) {
  const n = normalizeDelay(seconds);
  return n === 60 ? "1 minute" : `${n} seconds`;
}
