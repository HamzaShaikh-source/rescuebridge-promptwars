/**
 * ResourcesPage — GET /api/places nearest-help browser. Category grid,
 * distance/walk/drive, tappable phone, OPEN IN MAPS, NEAREST NOW + GO.
 */

import { useEffect, useState } from "react";
import {
  Phone,
  Navigation,
  Hospital,
  Droplets,
  Pill,
  Shield,
  Fuel,
  Ambulance,
  RefreshCw,
} from "lucide-react";
import { getPlaces, type PlaceCategory, type PlaceResult } from "../services/api";
import { useGeolocation } from "../hooks/useGeolocation";
import { useTriageContext } from "../context/TriageContext";

const CATS: { key: PlaceCategory; label: string; Icon: typeof Hospital }[] = [
  { key: "hospital", label: "HOSPITAL", Icon: Hospital },
  { key: "pharmacy", label: "PHARMACY", Icon: Pill },
  { key: "blood_bank", label: "BLOOD BANK", Icon: Droplets },
  { key: "police", label: "POLICE", Icon: Shield },
  { key: "fuel", label: "FUEL", Icon: Fuel },
  { key: "ambulance", label: "AMBULANCE", Icon: Ambulance },
];

export default function ResourcesPage() {
  const { fix, error: geoError, getOnce } = useGeolocation();
  const { result } = useTriageContext();

  const [category, setCategory] = useState<PlaceCategory>("hospital");
  const [places, setPlaces] = useState<PlaceResult[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      setBusy(true);
      setLoadError(null);
      let pos = fix;
      if (!pos) pos = await getOnce();
      if (!alive) return;
      if (!pos) {
        setLoadError(geoError ?? "Location unavailable — it fell back to a default point.");
        pos = { lat: 12.9716, lng: 77.5946, accuracy: null, timestamp: Date.now() };
      }
      try {
        const data = await getPlaces({
          lat: pos.lat,
          lng: pos.lng,
          category,
          limit: 5,
        });
        if (alive) setPlaces(data);
      } catch (e) {
        if (alive) setLoadError(String(e));
      } finally {
        if (alive) setBusy(false);
      }
    };
    void load();
    return () => {
      alive = false;
    };
  }, [category, fix, getOnce, geoError]);

  const origin = fix ? `${fix.lat.toFixed(5)},${fix.lng.toFixed(5)}` : "12.9716,77.5946";
  const nearest = places && places.length ? places[0] : null;

  return (
    <div className="space-y-3">
      <header className="panel-dark py-4">
        <h1 className="display text-[1.6rem] text-[#F5F5F0]">FIND HELP NEAR YOU</h1>
        <p className="mono text-xs text-[#9A9A8F]">
          {fix
            ? `POSITION ±${Math.round(fix.accuracy ?? 0)}M · ${origin}`
            : "LOCATING YOU… (OR USING DEMO POINT BENGALURU)"}
        </p>
      </header>

      <div className="grid grid-cols-3 gap-2" role="tablist" aria-label="Resource type">
        {CATS.map(({ key, label, Icon }) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={category === key}
            className={`btn-brutal flex-col gap-1 py-3 min-h-touch ${category === key ? "btn-brutal-red" : "btn-brutal-dark"}`}
            onClick={() => setCategory(key)}
          >
            <Icon className="w-5 h-5" aria-hidden="true" />
            <span className="text-[0.6rem]">{label}</span>
          </button>
        ))}
      </div>

      {loadError && (
        <div className="panel-dark mono text-xs sig-amber">⚠ {loadError}</div>
      )}

      {result && result.triage.handoff_packet.geotag && (
        <div className="panel-dark mono text-xs sig-green">
          ▶ USING YOUR ACTIVE INCIDENT POSITION FROM THE LAST TRIAGE.
        </div>
      )}

      {busy && (
        <div className="working-frame text-[#F5F5F0] py-4">
          <span className="working-block" aria-hidden="true" />
          <span className="display text-[1.1rem]">FINDING {category.toUpperCase()}…</span>
        </div>
      )}

      {/* Nearest now */}
      {nearest && (
        <div className="panel border-4 border-[#00C853]" data-role="nearest">
          <div className="label-block text-[#6E6E64]">NEAREST NOW</div>
          <div className="display text-[1.15rem] text-[#0A0A0A] mt-1">{nearest.name}</div>
          <p className="mono text-xs text-[#6E6E64] mt-1">
            {Math.round(nearest.distance_m)}M · WALK {nearest.walk_min}MIN · DRIVE{" "}
            {nearest.drive_min}MIN
          </p>
          <div className="grid grid-cols-2 gap-2 mt-2">
            {nearest.phone && (
              <a href={`tel:${nearest.phone.replace(/\D/g, "")}`} className="btn-brutal btn-brutal-blue text-xs" data-round>
                <Phone className="w-4 h-4" /> CALL
              </a>
            )}
            {nearest.map_url && (
              <a
                href={`${nearest.map_url}&destination=${encodeURIComponent(`${nearest.name}, ${nearest.address}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-brutal btn-brutal-dark text-xs"
              >
                <Navigation className="w-4 h-4" /> GO
              </a>
            )}
          </div>
        </div>
      )}

      {/* List */}
      <div className="space-y-2">
        {places?.map((p, i) => (
          <div key={`${p.name}-${i}`} className="panel">
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold text-[#0A0A0A]">{p.name}</span>
              <span className="label-block text-[#6E6E64] shrink-0">
                {Math.round(p.distance_m)}M
              </span>
            </div>
            <p className="mono text-xs text-[#6E6E64] mt-1">{p.address}</p>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className="mono text-xs text-[#6E6E64]">
                WALK {p.walk_min}MIN · DRIVE {p.drive_min}MIN
              </span>
              {p.open_now_24h && (
                <span className="mono text-xs sig-green font-bold">24/7</span>
              )}
              <a
                href={`${p.map_url ?? `https://www.google.com/maps/search/${encodeURIComponent(`${p.name}, ${p.address}`)}`}&destination=${encodeURIComponent(`${p.name}, ${p.address}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mono text-xs btn-brutal btn-brutal-paper text-[0.6rem] min-h-touch flex items-center gap-1 w-auto !px-3"
              >
                <Navigation className="w-3.5 h-3.5" /> OPEN IN MAPS
              </a>
            </div>
            {p.phone && (
              <a
                href={`tel:${p.phone.replace(/\D/g, "")}`}
                className="mono text-xs sig-blue mt-2 inline-flex items-center gap-1 min-h-touch underline decoration-2 underline-offset-4"
              >
                <Phone className="w-3.5 h-3.5" /> {p.phone}
              </a>
            )}
            {p.source === "mock" && i === 0 && (
              <p className="mono text-[0.6rem] text-[#9A9A8F] mt-2">
                DEMO DATA — LABELLED SOURCE: MOCK. REAL API IN PRODUCTION.
              </p>
            )}
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => {
          void getOnce();
        }}
        className="btn-brutal btn-brutal-dark text-xs"
      >
        <RefreshCw className="w-4 h-4" /> REFRESH POSITION
      </button>
    </div>
  );
}