/**
 * useProfile — ICE medical identity stored locally (localStorage).
 * Feeds medical_context flags into /api/triage submissions.
 */

import { useCallback, useEffect, useState } from "react";

export interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
  relation: string;
}

export interface Profile {
  name: string;
  blood_type: string;
  age: string;
  conditions: string[];
  allergies: string[];
  medications: string[];
  contacts: EmergencyContact[];
}

const EMPTY: Profile = {
  name: "",
  blood_type: "",
  age: "",
  conditions: [],
  allergies: [],
  medications: [],
  contacts: [],
};

const KEY = "rescuebridge.profile.v1";

function load(): Profile {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw);
    return { ...EMPTY, ...parsed };
  } catch {
    return EMPTY;
  }
}

export function useProfile() {
  const [profile, setProfile] = useState<Profile>(EMPTY);

  useEffect(() => {
    setProfile(load());
  }, []);

  const save = useCallback((next: Profile) => {
    setProfile(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* storage full/blocked — non-fatal */
    }
  }, []);

  const updateList = useCallback(
    (field: "conditions" | "allergies" | "medications", value: string) => {
      const clean = value
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      save({ ...profile, [field]: clean });
    },
    [profile, save],
  );

  /** Compose the medical-context sentence fed into triage input. */
  const asContext = useCallback((): string => {
    const parts: string[] = [];
    if (profile.blood_type) parts.push(`blood type ${profile.blood_type}`);
    if (profile.age) parts.push(`age ${profile.age}`);
    if (profile.conditions.length)
      parts.push(`condition: ${profile.conditions.join(", ")}`);
    if (profile.allergies.length)
      parts.push(`allergy: ${profile.allergies.join(", ")}`);
    if (profile.medications.length)
      parts.push(`medication: ${profile.medications.join(", ")}`);
    return parts.length ? `Patient profile: ${parts.join("; ")}.` : "";
  }, [profile]);

  const hydrateInput = useCallback(
    (rawText: string, languageTag: string) => {
      const context = asContext();
      const merged = context ? `${context} Emergency report: ${rawText}` : rawText;
      return { raw_text: merged, language_tag: languageTag };
    },
    [asContext],
  );

  return { profile, save, updateList, asContext, hydrateInput };
}