/**
 * ProfilePage — ICE (In Case of Emergency) profile stored locally. Blood type,
 * conditions, allergies, medications, emergency contacts. Injected into every
 * triage submission as medical_context.
 */

import { useState } from "react";
import { Plus, X, Save } from "lucide-react";
import { useTriageContext } from "../context/TriageContext";
import type { EmergencyContact } from "../hooks/useProfile";

export default function ProfilePage() {
  const { profile, save } = useTriageContext().profile;
  const [saved, setSaved] = useState(false);
  const [contacts, setContacts] = useState<EmergencyContact[]>(profile.contacts);
  const [name, setName] = useState(profile.name);
  const [blood, setBlood] = useState(profile.blood_type);
  const [age, setAge] = useState(profile.age);
  const [conditions, setConditions] = useState(profile.conditions.join(", "));
  const [allergies, setAllergies] = useState(profile.allergies.join(", "));
  const [medications, setMedications] = useState(profile.medications.join(", "));

  const persist = () => {
    save({
      name,
      blood_type: blood,
      age,
      conditions: conditions.split(",").map((s) => s.trim()).filter(Boolean),
      allergies: allergies.split(",").map((s) => s.trim()).filter(Boolean),
      medications: medications.split(",").map((s) => s.trim()).filter(Boolean),
      contacts,
    });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
  };

  const addContact = () => {
    setContacts((c) => [
      ...c,
      { id: crypto.randomUUID?.() ?? String(Date.now()), name: "", phone: "", relation: "" },
    ]);
  };

  return (
    <div className="space-y-3">
      <header className="panel-dark py-4">
        <h1 className="display text-[1.6rem] text-[#F5F5F0]">ICE PROFILE</h1>
        <p className="mono text-xs text-[#9A9A8F]">
          STORED ON THIS DEVICE ONLY · FED INTO EVERY TRIAGE REPORT
        </p>
      </header>

      <div className="panel space-y-3">
        <Field label="MY NAME">
          <input className="brutal-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="AGE">
            <input className="brutal-input" value={age} onChange={(e) => setAge(e.target.value)} placeholder="Age" inputMode="numeric" />
          </Field>
          <Field label="BLOOD TYPE">
            <input className="brutal-input" value={blood} onChange={(e) => setBlood(e.target.value)} placeholder="A+ / O-" />
          </Field>
        </div>
        <Field label="CONDITIONS (COMMA-SEPARATED)">
          <input className="brutal-input" value={conditions} onChange={(e) => setConditions(e.target.value)} placeholder="diabetes, asthma" />
        </Field>
        <Field label="ALLERGIES (COMMA-SEPARATED)">
          <input className="brutal-input" value={allergies} onChange={(e) => setAllergies(e.target.value)} placeholder="penicillin, peanuts" />
        </Field>
        <Field label="MEDICATIONS (COMMA-SEPARATED)">
          <input className="brutal-input" value={medications} onChange={(e) => setMedications(e.target.value)} placeholder="insulin, salbutamol" />
        </Field>
      </div>

      <div className="panel space-y-2">
        <div className="label-block text-[#0A0A0A]">EMERGENCY CONTACTS</div>
        {contacts.map((c, i) => (
          <div key={c.id} className="border-2 border-[#0A0A0A] p-2 space-y-2">
            <div className="flex gap-2">
              <input
                className="brutal-input"
                value={c.name}
                placeholder="Name"
                onChange={(e) =>
                  setContacts((cs) =>
                    cs.map((x) => (x.id === c.id ? { ...x, name: e.target.value } : x)),
                  )
                }
              />
              <input
                className="brutal-input"
                value={c.relation}
                placeholder="Relation"
                onChange={(e) =>
                  setContacts((cs) =>
                    cs.map((x) => (x.id === c.id ? { ...x, relation: e.target.value } : x)),
                  )
                }
              />
              <button
                type="button"
                onClick={() => setContacts((cs) => cs.filter((x) => x.id !== c.id))}
                className="btn-brutal btn-brutal-red min-h-touch min-w-touch !w-auto shrink-0"
                aria-label={`Remove contact ${i + 1}`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <input
              className="brutal-input"
              value={c.phone}
              placeholder="+91 phone"
              inputMode="tel"
              onChange={(e) =>
                setContacts((cs) =>
                  cs.map((x) => (x.id === c.id ? { ...x, phone: e.target.value } : x)),
                )
              }
            />
            {c.phone && (
              <a href={`tel:${c.phone.replace(/\D/g, "")}`} className="btn-brutal btn-brutal-blue text-xs">
                CALL {c.phone}
              </a>
            )}
          </div>
        ))}
        <button type="button" onClick={addContact} className="btn-brutal btn-brutal-dark text-xs">
          <Plus className="w-4 h-4" /> ADD CONTACT
        </button>
      </div>

      <button type="button" onClick={persist} className="btn-brutal btn-brutal-red">
        <Save className="w-5 h-5" /> {saved ? "SAVED ✓" : "SAVE ICE PROFILE"}
      </button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="label-block text-[#0A0A0A]">{label}</span>
      <span className="mt-1 block">{children}</span>
    </label>
  );
}