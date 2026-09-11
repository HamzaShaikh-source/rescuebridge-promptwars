/**
 * App — brutalist multi-page shell. Routes + fixed bottom tab bar + SOS FAB.
 * Shared triage/profile state lives here, handed down via TriageContext.
 */

import { useMemo } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useTriage } from "./hooks/useTriage";
import { useProfile } from "./hooks/useProfile";
import { TriageContext } from "./context/TriageContext";
import BottomNav from "./components/BottomNav";
import SosFab from "./components/SosFab";
import HomePage from "./pages/HomePage";
import PanicPage from "./pages/PanicPage";
import TriagePage from "./pages/TriagePage";
import ResourcesPage from "./pages/ResourcesPage";
import HistoryPage from "./pages/HistoryPage";
import ProfilePage from "./pages/ProfilePage";
import AboutPage from "./pages/AboutPage";

export default function App() {
  const triage = useTriage();
  const profile = useProfile();
  const location = useLocation();

  const value = useMemo(
    () => ({ ...triage, profile }),
    [triage, profile],
  );

  const showFab = location.pathname !== "/panic";

  return (
    <TriageContext.Provider value={value}>
      <div className="brutal min-h-screen bg-[#0A0A0A] text-[#F5F5F0]">
        <a href="#main" className="skip-link">
          Skip to main content
        </a>

        <div id="main" className="max-w-[480px] mx-auto px-2 pb-28 pt-2">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/panic" element={<PanicPage />} />
            <Route path="/triage" element={<TriagePage />} />
            <Route path="/resources" element={<ResourcesPage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/history/:id" element={<HistoryPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>

        {showFab && <SosFab />}
        <BottomNav />
      </div>
    </TriageContext.Provider>
  );
}