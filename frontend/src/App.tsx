import { useCallback } from "react";
import {
  AlertTriangle,
  Heart,
  Phone,
  Shield,
  Loader2,
  RotateCcw,
} from "lucide-react";
import HeroInput from "./components/HeroInput";
import TriageCard from "./components/TriageCard";
import HistoryDrawer from "./components/HistoryDrawer";
import { useTriage } from "./hooks/useTriage";

function Header() {
  return (
    <header className="text-center space-y-2 py-6">
      <div className="flex items-center justify-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-emergency-red flex items-center justify-center">
          <Shield className="w-7 h-7 text-white" aria-hidden="true" />
        </div>
        <h1 className="text-panic-2xl font-extrabold tracking-tight">
          RescueBridge
        </h1>
      </div>
      <p className="text-emergency-muted text-sm max-w-md mx-auto">
        Gemini-powered verified emergency triage. Describe anything — voice,
        photo, or text — and get structured, verified life-saving guidance.
      </p>
    </header>
  );
}

function ErrorBanner({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div
      role="alert"
      className="card bg-emergency-red/10 border-emergency-red/30 flex items-center gap-3"
    >
      <AlertTriangle className="w-6 h-6 text-emergency-red flex-shrink-0" />
      <p className="flex-1 text-sm">{message}</p>
      <button
        onClick={onDismiss}
        className="text-emergency-muted hover:text-white text-sm underline min-h-touch"
        aria-label="Dismiss error"
      >
        Dismiss
      </button>
    </div>
  );
}

function LoadingOverlay() {
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center">
      <div className="card text-center space-y-4 max-w-sm mx-4">
        <Loader2 className="w-12 h-12 text-emergency-red animate-spin mx-auto" />
        <p className="text-panic-xl font-bold">Analysing Emergency…</p>
        <p className="text-emergency-muted text-sm">
          Cross-referencing inputs, verifying facts, generating action plan
        </p>
      </div>
    </div>
  );
}

export default function App() {
  const { loading, error, result, history, lifecycle, ledger, submit, advance, confirm, clear } = useTriage();

  const handleSubmit = useCallback(
    (data: {
      raw_text: string;
      audio_base64?: string;
      image_base64?: string;
      language_tag: string;
    }) => {
      submit({
        raw_text: data.raw_text,
        audio_base64: data.audio_base64,
        image_base64: data.image_base64,
        geolocation: undefined,
        language_tag: data.language_tag,
      });
    },
    [submit],
  );

  const handleHistorySelect = useCallback(() => {
    clear();
  }, [clear]);

  return (
    <div className="min-h-screen">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      {loading && <LoadingOverlay />}

      <div id="main-content" className="max-w-2xl mx-auto px-4 pb-24 space-y-6">
        <Header />

        {/* Hero input */}
        <HeroInput onSubmit={handleSubmit} loading={loading} />

        {/* Error */}
        {error && <ErrorBanner message={error} onDismiss={clear} />}

        {/* Triage result */}
        {result && (
          <>
            <TriageCard
              result={result}
              lifecycle={lifecycle}
              ledger={ledger}
              onAdvanceLifecycle={advance}
              onConfirmContradiction={confirm}
            />
            <button
              onClick={clear}
              className="btn-secondary w-full"
              aria-label="Submit another emergency"
            >
              <RotateCcw className="w-5 h-5" />
              <span>Submit Another Emergency</span>
            </button>
          </>
        )}

        {/* History */}
        <HistoryDrawer
          history={history}
          onSelect={handleHistorySelect}
        />

        {/* Footer */}
        <footer className="text-center text-emergency-muted text-xs pt-8 pb-4 space-y-1">
          <p>
            RescueBridge — PromptWars Hackathon 2026
          </p>
          <p>
            Emergency number: <strong>112</strong> (India)
          </p>
          <p className="flex items-center justify-center gap-1">
            Built with <Heart className="w-3 h-3 text-emergency-red" /> using
            Gemini AI
          </p>
        </footer>
      </div>

      {/* Floating Call 112 button (mobile) */}
      <a
        href="tel:112"
        className="fixed bottom-6 right-6 z-40 btn-red !rounded-full !w-16 !h-16
                   shadow-2xl shadow-red-900/50 sm:hidden"
        aria-label="Call 112"
      >
        <Phone className="w-7 h-7" />
      </a>
    </div>
  );
}
