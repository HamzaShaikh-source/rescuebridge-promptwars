/**
 * useSpeech — Web Speech API read-aloud for triage plans.
 * Auto-reads once after triage, with repeat/stop always on-screen.
 */

import { useCallback, useEffect, useRef, useState } from "react";

interface SpeechState {
  speaking: boolean;
  supported: boolean;
}

export function useSpeech() {
  const [state, setState] = useState<SpeechState>({
    speaking: false,
    supported: typeof window !== "undefined" && "speechSynthesis" in window,
  });

  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const stop = useCallback(() => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    setState((s) => ({ ...s, speaking: false }));
  }, []);

  const speak = useCallback(
    (text: string, lang?: string) => {
      if (!("speechSynthesis" in window)) return;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 0.95;
      const code = lang || "en-IN";
      u.lang =
        code === "hi" ? "hi-IN" : code === "kn" ? "kn-IN" : code === "ta" ? "ta-IN" : "en-IN";
      u.onend = () => setState((s) => ({ ...s, speaking: false }));
      u.onerror = () => setState((s) => ({ ...s, speaking: false }));
      utteranceRef.current = u;
      window.speechSynthesis.speak(u);
      setState((s) => ({ ...s, speaking: true }));
    },
    [],
  );

  useEffect(() => stop, [stop]);

  return { ...state, speak, stop };
}