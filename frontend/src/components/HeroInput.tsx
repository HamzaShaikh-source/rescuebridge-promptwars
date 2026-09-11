/**
 * HeroInput — the primary "Anything → Action" input component.
 * Accepts voice, photo, or text. Panic-proof: large targets, high contrast.
 */

import { useCallback, useRef, useState } from "react";
import {
  Mic,
  MicOff,
  Camera,
  Send,
  X,
  Globe,
  Loader2,
} from "lucide-react";
import { useAudioRecorder } from "../hooks/useAudioRecorder";

interface HeroInputProps {
  onSubmit: (data: {
    raw_text: string;
    audio_base64?: string;
    image_base64?: string;
    language_tag: string;
  }) => void;
  loading: boolean;
}

const LANGUAGES = [
  { code: "auto", label: "Auto-detect" },
  { code: "en", label: "English" },
  { code: "hi", label: "हिन्दी" },
  { code: "kn", label: "ಕನ್ನಡ" },
  { code: "ta", label: "தமிழ்" },
  { code: "te", label: "తెలుగు" },
  { code: "bn", label: "বাংলা" },
];

export default function HeroInput({ onSubmit, loading }: HeroInputProps) {
  const [text, setText] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [language, setLanguage] = useState("auto");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const {
    isRecording,
    duration,
    analyserLevel,
    startRecording,
    stopRecording,
    cancelRecording,
  } = useAudioRecorder();

  const [audioBase64, setAudioBase64] = useState<string | null>(null);

  const handleRecord = useCallback(async () => {
    if (isRecording) {
      const data = await stopRecording();
      setAudioBase64(data);
    } else {
      setAudioBase64(null);
      await startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  const handleImage = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (file.size > 10 * 1024 * 1024) {
        alert("Image must be under 10 MB");
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        setImagePreview(result);
        setImageBase64(result);
      };
      reader.readAsDataURL(file);
    },
    [],
  );

  const clearImage = useCallback(() => {
    setImagePreview(null);
    setImageBase64(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const handleSubmit = useCallback(() => {
    const raw_text = text.trim();
    if (!raw_text && !audioBase64 && !imageBase64) {
      textareaRef.current?.focus();
      return;
    }
    onSubmit({
      raw_text,
      audio_base64: audioBase64 ?? undefined,
      image_base64: imageBase64 ?? undefined,
      language_tag: language,
    });
  }, [text, audioBase64, imageBase64, language, onSubmit]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  const hasInput = text.trim() || audioBase64 || imageBase64;

  return (
    <section className="card space-y-5" aria-label="Emergency input">
      {/* Text area */}
      <div>
        <label
          htmlFor="emergency-text"
          className="block text-emergency-muted text-sm mb-2"
        >
          Describe what you see or feel… (e.g. "Car crash on 5th, driver
          bleeding from head, diabetic history")
        </label>
        <textarea
          ref={textareaRef}
          id="emergency-text"
          rows={4}
          className="w-full bg-emergency-bg text-emergency-text rounded-xl px-4 py-3
                     text-panic-lg placeholder:text-emergency-muted/50
                     border border-white/10 focus:border-emergency-red focus:ring-2
                     focus:ring-emergency-red/30 resize-none transition-colors"
          placeholder="Type your emergency description…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading}
          aria-describedby="text-help"
        />
        <p id="text-help" className="text-xs text-emergency-muted mt-1">
          Press <kbd className="px-1 py-0.5 bg-emergency-surface2 rounded">Ctrl</kbd> +{" "}
          <kbd className="px-1 py-0.5 bg-emergency-surface2 rounded">Enter</kbd> to
          submit
        </p>
      </div>

      {/* Image preview */}
      {imagePreview && (
        <div className="relative inline-block">
          <img
            src={imagePreview}
            alt="Scene photo preview"
            className="rounded-xl max-h-40 border border-white/10"
          />
          <button
            onClick={clearImage}
            className="absolute -top-2 -right-2 bg-emergency-red rounded-full p-1
                       min-h-touch min-w-touch flex items-center justify-center"
            aria-label="Remove photo"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>
      )}

      {/* Audio recording indicator */}
      {isRecording && (
        <div
          className="flex items-center gap-3 bg-emergency-red/20 rounded-xl px-4 py-3"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-end gap-1 h-8" aria-hidden="true">
            {Array.from({ length: 12 }).map((_, i) => (
              <div
                key={i}
                className="waveform-bar"
                style={{
                  height: `${Math.max(4, analyserLevel * 32)}px`,
                  animationDelay: `${i * 0.05}s`,
                  opacity: 0.4 + analyserLevel * 0.6,
                }}
              />
            ))}
          </div>
          <span className="text-emergency-red font-bold text-sm">
            Recording {duration}s
          </span>
          <button
            onClick={cancelRecording}
            className="text-emergency-muted hover:text-white min-h-touch min-w-touch
                       flex items-center justify-center"
            aria-label="Cancel recording"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Audio preview */}
      {!isRecording && audioBase64 && (
        <div className="bg-emergency-surface2 rounded-xl px-4 py-3 flex items-center gap-3">
          <MicOff className="w-5 h-5 text-emergency-muted" />
          <span className="text-sm text-emergency-muted">
            Voice note recorded
          </span>
          <button
            onClick={() => setAudioBase64(null)}
            className="text-emergency-red text-sm underline min-h-touch"
            aria-label="Remove voice note"
          >
            Remove
          </button>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap gap-3 items-center">
        {/* Microphone */}
        <button
          onClick={handleRecord}
          disabled={loading}
          className={`btn-emergency ${
            isRecording
              ? "bg-emergency-red animate-pulse"
              : "bg-emergency-surface2 hover:bg-emergency-surface2/80"
          } border border-white/10`}
          aria-label={isRecording ? "Stop recording" : "Record voice note"}
        >
          {isRecording ? (
            <MicOff className="w-6 h-6 text-white" />
          ) : (
            <Mic className="w-6 h-6" />
          )}
        </button>

        {/* Photo upload */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={loading}
          className="btn-emergency bg-emergency-surface2 hover:bg-emergency-surface2/80
                     border border-white/10"
          aria-label="Upload scene photo"
        >
          <Camera className="w-6 h-6" />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleImage}
          className="sr-only"
          aria-label="Choose photo"
        />

        {/* Language selector */}
        <div className="flex items-center gap-1 text-emergency-muted">
          <Globe className="w-4 h-4" aria-hidden="true" />
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="bg-transparent text-sm border-none focus:ring-0 cursor-pointer
                       min-h-touch"
            aria-label="Select language"
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* SUBMIT — the big red button */}
        <button
          onClick={handleSubmit}
          disabled={loading || !hasInput}
          className="btn-red flex-1 sm:flex-none"
          aria-label="Trigger emergency triage"
        >
          {loading ? (
            <>
              <Loader2 className="w-6 h-6 animate-spin" />
              <span>Analysing…</span>
            </>
          ) : (
            <>
              <Send className="w-6 h-6" />
              <span>TRIGGER EMERGENCY TRIAGE</span>
            </>
          )}
        </button>
      </div>
    </section>
  );
}
