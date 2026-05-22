import { isTimerSoundMuted } from "@/lib/timerSound";

export const DEFAULT_DOCUMENT_TITLE = "Focus Flow — Brew a session";

/** ♪ with one diagonal slash when timer sound is muted */
const SOUND_ON = "♪ ";
const SOUND_MUTED = "♪\u0338 ";

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const sec = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export function buildTimerDocumentTitle(remainingSeconds: number, muted = isTimerSoundMuted()): string {
  const time = formatTime(remainingSeconds);
  const soundIcon = muted ? SOUND_MUTED : SOUND_ON;
  return `Focus Flow — ${soundIcon}${time}`;
}
