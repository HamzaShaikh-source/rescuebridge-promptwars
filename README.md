# RescueBridge 🚨

**Gemini-Powered Verified Emergency Response & Triage Assistant**

> A universal emergency-safety assistant that bridges chaotic human distress and precision
> emergency response. Ingests messy, unstructured multi-modal inputs (panicked voice notes,
> scene/injury photos, rambling text) and converts them into verified triage summaries,
> life-saving action plans, and dispatch-ready handoff packets.

---

## Architecture

```
┌───────────────────────────────────────────────────────────────┐
│  Frontend (React 19 / Vite / TypeScript / Tailwind CSS)       │
│  ┌─────────┐ ┌──────────┐ ┌────────────┐ ┌────────────────┐  │
│  │ HeroInput│ │TriageCard│ │VerifyBadge │ │ HandoffPanel   │  │
│  │(mic/photo│ │(4 tabs)  │ │(shield icon│ │ (copy + call)  │  │
│  │ /text)   │ │          │ │ /status)   │ │                │  │
│  └────┬─────┘ └────┬─────┘ └─────┬──────┘ └───────┬────────┘  │
│       └─────────────┴────────────┴─────────────────┘           │
│                            │                                   │
│  hooks: useAudioRecorder, useTriage  ·  services: api.ts       │
└────────────────────────────┼───────────────────────────────────┘
                             │ POST /api/triage
                             ▼
┌───────────────────────────────────────────────────────────────┐
│  Backend (FastAPI / Python 3.12+)                             │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ API Layer: /triage · /history · /health                  │ │
│  └────────────────────┬─────────────────────────────────────┘ │
│                       │                                       │
│  ┌────────────────────▼─────────────────────────────────────┐ │
│  │ Services                                                │ │
│  │ ┌──────────────┐ ┌──────────┐ ┌────────┐ ┌───────────┐  │ │
│  │ │Gemini Engine │ │Places API│ │  TTS   │ │Firestore  │  │ │
│  │ │(Structured   │ │(nearest  │ │(speech │ │(audit log)│  │ │
│  │ │ JSON Output) │ │ ERs)     │ │ synth) │ │           │  │ │
│  │ └──────┬───────┘ └──────────┘ └────────┘ └───────────┘  │ │
│  │        │                                                 │ │
│  │ ┌──────▼──────────────────────────────────────────────┐  │ │
│  │ │ Consensus Verification Engine                       │  │ │
│  │ │ (weather + news + traffic + Gemini knowledge)       │  │ │
│  │ └─────────────────────────────────────────────────────┘  │ │
│  └──────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────┘
```

## Features

- **Multi-modal input**: Voice (any Indian language), photos, rambling text — all in one interface
- **Gemini Structured Output**: AI produces strict JSON triage packets via JSON Schema mode
- **Consensus Verification Engine**: Cross-checks input against weather, news, traffic, and Gemini knowledge; every output carries VERIFIED / PARTIAL / CONFLICT status
- **Panic-to-Precision Handoff Packet**: Dispatch-ready JSON formatted for 112 operators and incoming EMTs
- **Nearest Hospital Lookup**: Google Maps Places API finds 3 nearest 24/7 ERs
- **Audio Instructions**: "Speak Instructions Aloud" with Web Speech API / Google Cloud TTS
- **One-Tap 112**: Floating call button, always accessible
- **Firestore Audit Log**: Every incident timestamped and persisted
- **Fully Accessible**: WCAG 2.1 AA — 48px+ touch targets, high contrast, keyboard nav, ARIA labels
- **112 Only**: Indian emergency context throughout — never 911

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite, TypeScript, Tailwind CSS, Lucide Icons |
| Backend | FastAPI, Python 3.12, Pydantic v2 |
| AI/LLM | Google Gemini 2.5 Flash (Structured Output / JSON Schema) |
| Maps | Google Maps Places API |
| TTS | Google Cloud TTS + Web Speech API fallback |
| Database | Google Cloud Firestore (in-memory fallback for dev) |
| Deployment | Docker, Cloud Run |

## Quick Start

### Prerequisites

- Python 3.12+
- Node.js 20+
- A Gemini API key ([get one here](https://aistudio.google.com/apikey))

### 1. Clone & configure

```bash
git clone <your-repo-url>
cd promptwars
cp .env.example .env
# Edit .env and set GEMINI_API_KEY (required)
```

### 2. Run the backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### 3. Run the frontend

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

### 4. Run tests

```bash
cd backend
pip install pytest pytest-timeout httpx
python -m pytest tests/ -v
```

## Docker Compose

```bash
cp .env.example .env
# Set GEMINI_API_KEY in .env
docker compose up --build
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/triage` | Full multimodal triage pipeline |
| `GET` | `/api/history` | Recent 20 incident records |
| `GET` | `/api/history/:id` | Single incident by ID |
| `GET` | `/api/health` | Cloud Run healthcheck |
| `GET` | `/api/docs` | OpenAPI/Swagger docs |

### POST /api/triage — Request Body

```json
{
  "raw_text": "Car crash on MG Road, driver bleeding from head, diabetic",
  "image_base64": "data:image/jpeg;base64,...",
  "audio_base64": "data:audio/webm;codecs=opus;base64,...",
  "geolocation": { "lat": 12.9716, "lng": 77.5946 },
  "language_tag": "auto"
}
```

### Response includes:

- Structured triage (severity, headline, actions, escalation)
- Verification status (VERIFIED / PARTIAL / CONFLICT) with check details
- Handoff packet (dispatch-ready JSON)
- Nearest hospitals (from Places API)
- Audio URL (TTS, if configured)

## Challenge Alignment

| # | Requirement | What RescueBridge Delivers |
|---|------------|---------------------------|
| 1 | Code Quality | Full type safety (TypeScript + Pydantic), strict mode, modular architecture |
| 2 | Security | GEMINI_API_KEY server-side only, input sanitisation, HTML escaping, length limits |
| 3 | Efficiency | Vite build, lazy loading, LRU-cached config, minimal bundle |
| 4 | Testing | 60 unit tests: input validation, severity rules, verification logic, API endpoints |
| 5 | Accessibility | WCAG 2.1 AA, 48px touch targets, ARIA labels, keyboard nav, high-contrast theme |
| 6 | Google Ecosystem | Gemini Structured Output + Places API + Cloud TTS + Firestore + Cloud Run |
| 7 | Alignment | Every input → verified structured output + action card + audio readout + handoff packet + audit log |

## Deployment to Cloud Run

```bash
# Build and deploy backend
cd backend
gcloud run deploy rescuebridge-api \
  --source . \
  --platform managed \
  --region asia-south1 \
  --allow-unauthenticated \
  --set-env-vars GEMINI_API_KEY=your-key

# Build and deploy frontend
cd frontend
gcloud run deploy rescuebridge-ui \
  --source . \
  --platform managed \
  --region asia-south1 \
  --allow-unauthenticated
```

## Firestore Security Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /emergency_incidents/{incidentId} {
      // Authenticated users can read their own incidents
      allow read: if request.auth != null && request.auth.uid == resource.data.userId;
      // Any authenticated user can create incidents
      allow create: if request.auth != null;
      // No updates or deletes for audit integrity
      allow update, delete: if false;
    }
  }
}
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | ✅ Yes | Google Gemini API key |
| `GOOGLE_MAPS_API_KEY` | Optional | Google Maps Places API key |
| `GOOGLE_TTS_CREDENTIALS_PATH` | Optional | Path to Google Cloud TTS service account |
| `FIRESTORE_PROJECT_ID` | Optional | Firebase project ID |
| `FIRESTORE_CREDENTIALS_PATH` | Optional | Path to Firestore service account |

## License

MIT — Built for the PromptWars Hackathon 2026.
