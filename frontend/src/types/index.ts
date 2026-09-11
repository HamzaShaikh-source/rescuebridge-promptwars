/**
 * RescueBridge TypeScript types — mirrors backend Pydantic schemas exactly.
 */

export type Severity = "P1_CRITICAL" | "P2_SERIOUS" | "P3_MODERATE" | "P4_LOW";
export type Escalation =
  | "CALL_112_IMMEDIATELY"
  | "VISIT_ER"
  | "URGENT_CARE"
  | "POISON_CONTROL"
  | "SELF_CARE";
export type VerificationStatus = "VERIFIED" | "PARTIAL" | "CONFLICT";

export interface GeoLocation {
  lat: number;
  lng: number;
}

export interface TriageInput {
  raw_text: string;
  audio_base64?: string;
  image_base64?: string;
  geolocation?: GeoLocation;
  language_tag: string;
  weather_notes?: string;
  traffic_notes?: string;
  news_notes?: string;
}

export interface MedicalContext {
  symptoms: string[];
  vitals_mentioned: string[];
  drug_flags: string[];
  allergy_flags: string[];
}

export interface VerificationCheck {
  source: string;
  result: string;
}

export interface Verification {
  status: VerificationStatus;
  checks_done: VerificationCheck[];
  contradictions: string[];
  uncertainties: string[];
}

export interface HandoffPacket {
  incident_id: string;
  geotag: GeoLocation | null;
  severity: Severity;
  timestamp: string;
  timeline: string[];
  verified_facts: string[];
  unverified: string[];
  recommended_escalation: Escalation;
  input_types_used: string[];
}

export interface EnvironmentalHazard {
  hazard_type: string;
  description: string;
  severity_impact: string;
}

export interface TriageOutput {
  severity: Severity;
  headline: string;
  medical_context: MedicalContext;
  noise_filtered: string[];
  immediate_actions: string[];
  escalation: Escalation;
  verification: Verification;
  handoff_packet: HandoffPacket;
  environmental_hazards: EnvironmentalHazard[];
  language_detected: string;
}

export interface NearbyPlace {
  name: string;
  address: string;
  distance_m: number;
  rating: number | null;
  open_now: boolean | null;
  phone: string | null;
  map_url: string | null;
}

export interface TriageResponse {
  success: boolean;
  triage: TriageOutput;
  nearby_places: NearbyPlace[];
  audio_url: string | null;
}

export interface HealthResponse {
  status: string;
  gemini_configured: boolean;
  maps_configured: boolean;
  timestamp: string;
}

export interface IncidentRecord {
  id: string;
  created_at: string;
  severity: Severity;
  headline: string;
  verification_status: VerificationStatus;
  input_types_used: string[];
  triage: TriageOutput;
}
