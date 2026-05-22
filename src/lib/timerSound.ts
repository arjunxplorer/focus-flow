const MUTE_KEY = "focus-flow-timer-sound-muted";
const MUTE_CHANGE_EVENT = "focus-flow-timer-sound-muted-change";

export function subscribeTimerSoundMuted(onChange: () => void): () => void {
  window.addEventListener(MUTE_CHANGE_EVENT, onChange);
  return () => window.removeEventListener(MUTE_CHANGE_EVENT, onChange);
}

export function isTimerSoundMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setTimerSoundMuted(muted: boolean): void {
  try {
    localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
    window.dispatchEvent(new Event(MUTE_CHANGE_EVENT));
  } catch {
    /* ignore */
  }
}

/** Short warm chime via Web Audio — no external asset required */
export function playTimerCompleteSound(): void {
  if (isTimerSoundMuted()) return;
  try {
    const ctx = new AudioContext();
    const now = ctx.currentTime;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.22, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);
    gain.connect(ctx.destination);

    const playTone = (freq: number, start: number, duration: number) => {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, start);
      osc.connect(gain);
      osc.start(start);
      osc.stop(start + duration);
    };

    playTone(523.25, now, 0.2);
    playTone(659.25, now + 0.12, 0.35);
    void ctx.resume();
    window.setTimeout(() => void ctx.close(), 700);
  } catch {
    /* autoplay or AudioContext unsupported */
  }
}
