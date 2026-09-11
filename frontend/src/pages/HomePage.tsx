/**
 * HomePage — non-emergency landing. Persistent voice panel, fast panic CTA,
 * quick links to resources, history, and about.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Mic, MicOff, Info, MapPin, Clock } from "lucide-react";
import { useAudioRecorder } from "../hooks/useAudioRecorder";

export default function HomePage() {
  const navigate = useNavigate();
  const {
    isRecording,
    duration,
    analyserLevel,
    startRecording,
    stopRecording,
  } = useAudioRecorder();

  const [transcript, setTranscript] = useState("");
  const [speechSupported, setSpeechSupported] = useState(false);
  const recognitionRef = useRef<{ start: () => void; stop: () => void } | null>(null);

  useEffect(() => {
    const SR = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (!SR) return;
    setSpeechSupported(true);
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-IN";
    rec.onresult = (e: any) => {
      let t = "";
      for (let i = 0; i < e.results.length; i++) {
        t += e.results[i][0].transcript;
      }
      setTranscript(t);
    };
    rec.onerror = () => {};
    rec.onend = () => {};
    recognitionRef.current = rec;
  }, []);

  const toggleMic = useCallback(async () => {
    if (isRecording) {
      await stopRecording();
      recognitionRef.current?.stop();
    } else {
      setTranscript("");
      await startRecording();
      try { recognitionRef.current?.start(); } catch { /* already started */ }
    }
  }, [isRecording, startRecording, stopRecording, recognitionRef]);

  return (
    <div className="space-y-4">
      {/* Hero */}
      <header className="panel-dark text-center py-8 md:py-12">
        <div className="label-block text-[#9A9A8F] tracking-[0.3em]">PANIC → VERIFIED HANDOFF</div>
        <h1 className="display text-[2.4rem] md:text-[3.4rem] leading-tight mt-2 text-[#F5F5F0]">RESCUEBRIDGE</h1>
        <p className="mono text-xs text-[#9A9A8F] mt-2 max-w-[320px] md:max-w-none mx-auto">
          TELL YOU WHAT TO DO, IN ORDER, RIGHT NOW. NO TYPING. THREE TAPS.
        </p>
      </header>

      {/* SOS CTA */}
      <button
        type="button"
        className="sos-pill"
        onClick={() => navigate("/panic")}
        aria-label="Open emergency panic triage — tap to start"
      >
        HOLD TO SOS →
      </button>

      {/* Voice panel */}
      <section className="panel" aria-label="Voice capture">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={toggleMic}
            className={`btn-brutal ${isRecording ? "btn-brutal-red" : "btn-brutal-dark"} min-h-touch min-w-touch !w-auto shrink-0`}
            aria-label={isRecording ? "Stop microphone" : "Start microphone"}
          >
            {isRecording ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
          </button>

          <div className="flex-1 overflow-hidden">
            {isRecording ? (
              <div className="flex items-end gap-[3px] h-8" aria-hidden="true">
                {Array.from({ length: 24 }).map((_, i) => (
                  <div
                    key={i}
                    className="waveform-bar"
                    style={{
                      height: `${Math.max(analyserLevel * 100, 8)}%`,
                      animationDelay: `${i * 0.04}s`,
                    }}
                  />
                ))}
              </div>
            ) : (
              <div className="mono text-xs text-[#6E6E64]">
                TAP MIC TO START VOICE CAPTURE
              </div>
            )}
            {isRecording && (
              <div className="mono text-xs text-[#9A9A8F] mt-1">
                RECORDING {duration}s
              </div>
            )}
          </div>
        </div>

        {(transcript || isRecording) && (
          <div className="mono text-sm sig-amber mt-2 bg-[#0A0A0A] border-2 border-[#FFB000] p-2">
            {transcript ? (
              <>
                <span className="label-block text-[#F5F5F0]">HEARD:</span>{" "}
                <span className="text-[#F5F5F0]">{transcript}</span>
              </>
            ) : (
              <span className="text-[#9A9A8F]">LISTENING…</span>
            )}
          </div>
        )}

        <p className="mono text-[0.65rem] text-[#6E6E64] mt-2">
          {speechSupported
            ? "Partial transcript via browser Speech API — not sent to backend."
            : "Speech transcript not available in this browser; audio is recorded and sent."}
        </p>
      </section>

      {/* Quick links */}
      <div className="grid grid-cols-2 gap-2">
        <Link to="/resources" className="btn-brutal btn-brutal-dark text-xs">
          <MapPin className="w-5 h-5" /> NEARBY HELP
        </Link>
        <Link to="/history" className="btn-brutal btn-brutal-dark text-xs">
          <Clock className="w-5 h-5" /> HISTORY
        </Link>
      </div>

      <Link to="/about" className="btn-brutal btn-brutal-dark text-xs flex items-center justify-center gap-2">
        <Info className="w-5 h-5" /> HOW THIS WORKS
      </Link>

      <p className="mono text-[0.6rem] text-center text-[#444440] py-2">
        USE IN EMERGENCY ONLY. NEVER DELAY CALLING 112.
      </p>
    </div>
  );
}