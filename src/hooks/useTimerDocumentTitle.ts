import { useEffect, useState } from "react";
import { useTimerActive, useTimerRemaining } from "@/contexts/TimerContext";
import { buildTimerDocumentTitle, DEFAULT_DOCUMENT_TITLE } from "@/lib/documentTitle";
import { isTimerSoundMuted, subscribeTimerSoundMuted } from "@/lib/timerSound";

/** Keeps the browser tab title in sync with the active focus timer. */
export function useTimerDocumentTitle() {
  const active = useTimerActive();
  const remaining = useTimerRemaining();
  const [muted, setMuted] = useState(isTimerSoundMuted);

  useEffect(() => subscribeTimerSoundMuted(() => setMuted(isTimerSoundMuted())), []);

  useEffect(() => {
    document.title = active ? buildTimerDocumentTitle(remaining, muted) : DEFAULT_DOCUMENT_TITLE;
  }, [active, remaining, muted]);

  useEffect(() => {
    return () => {
      document.title = DEFAULT_DOCUMENT_TITLE;
    };
  }, []);
}
