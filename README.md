# Posture Behaviour Monitor

A real-time browser-based posture monitoring system built with HTML5, CSS3, JavaScript (ES modules), Vite, and Google MediaPipe Tasks Vision, integrated with a Spring Boot 3 + MySQL backend and Google Gemini generative AI insights.

---

## Architecture Overview

```
                      ┌─────────────────────────────────────────┐
                      │            Browser Client               │
                      │  - Webcam Feed & Canvas Skeleton        │
                      │  - MediaPipe PoseLandmarker (WASM/GPU)  │
                      │  - 5s Calibration & Baseline in Storage │
                      │  - 5s Temporal Persistence & Alerts     │
                      │  - Web Audio API Chime (10s Cooldown)   │
                      │  - Saved Sessions & Insights UI         │
                      └──────────────────┬──────────────────────┘
                                         │ REST (JSON)
                                         ▼
                      ┌─────────────────────────────────────────┐
                      │       Spring Boot 3 API (:8080)         │
                      │  - Session & Event Persistence          │
                      │  - CORS Configuration                   │
                      │  - InsightService with RestClient       │
                      └───────┬─────────────────────────┬───────┘
                              │ JPA / Hibernate         │ HTTPS / REST
                              ▼                         ▼
                  ┌──────────────────────┐  ┌──────────────────────┐
                  │     MySQL Database   │  │   Google Gemini API  │
                  │   - posture_sessions │  │  (gemini-1.5-flash)  │
                  │   - posture_events   │  │  Rule-based fallback │
                  └──────────────────────┘  └──────────────────────┘
```

---

## 1. Frontend Setup & Run

**Requirements:** Node.js 18+ and npm.

```bash
# 1. Install dependencies
npm install

# 2. Run automated frontend unit tests
npm test

# 3. Build production bundle
npm run build

# 4. Start local development server
npm run dev
```

Open the Vite URL (default `http://localhost:5173`) in your browser and allow webcam permissions.

---

## 2. Backend Setup & Run

**Requirements:** Java 17+ or Java 21+, MySQL 8+.

The Maven Wrapper is included in `backend/` (`mvnw.cmd` for Windows, `./mvnw` for Linux/macOS).

### A. Start MySQL
Ensure your local MySQL service (e.g., `MySQL80` on Windows) is running.

### B. Configure Environment Variables & Start Backend

#### Windows (PowerShell):
```powershell
cd backend

# If your system default Java is older (e.g. Java 8), point JAVA_HOME to JDK 17/21:
$env:JAVA_HOME = "C:\Users\prana\.vscode\extensions\redhat.java-1.56.0-win32-x64\jre\21.0.12.1-win32-x86_64"

# Set your local MySQL password:
$env:DB_PASSWORD = "your_mysql_password"

# Optional: set Gemini API Key (obtained from Google AI Studio):
$env:GEMINI_API_KEY = "your_gemini_api_key"

# Start Spring Boot backend:
.\mvnw.cmd spring-boot:run
```

#### Linux / macOS:
```bash
cd backend
export DB_PASSWORD="your_mysql_password"
export GEMINI_API_KEY="your_gemini_api_key"
./mvnw spring-boot:run
```

### C. Verify API Health
Open in browser or terminal:
```bash
curl http://localhost:8080/api/health
# Returns: {"status":"ok","service":"Posture Behaviour Monitor API"}
```

---

## 3. Automated Test Suites

### Backend Tests (Spring Boot + H2 in-memory)
Runs 6 automated tests covering healthcheck, session persistence, missing session 404, bad request validation, and Gemini rule-based fallback without needing a live MySQL database or external API key:
```powershell
cd backend
.\mvnw.cmd test
```

### Frontend Tests (Node.js native test runner)
Runs 13 automated unit tests covering landmark validation, aspect ratio scaling, desk occlusion detection, shoulder tilt calculation, deviation calculation, and 5-second temporal persistence / 10-second alert cooldown:
```bash
npm test
```

---

## 4. Posture Calculations & Metric Definitions

| Metric | Anatomical Basis | Plane & View | Threshold | Notes & Edge Cases |
| :--- | :--- | :--- | :--- | :--- |
| **Head / Neck Angle** | Vector from shoulder midpoint to ear midpoint vs. upward vertical | Coronal (Frontal) | $\pm 10.0^\circ$ | Measures lateral head tilt. Sagittal forward-head slouching is not directly measurable in 2D frontal webcam view without depth/profile. |
| **Torso Inclination** | Vector from hip midpoint to shoulder midpoint vs. upward vertical | Coronal (Frontal) | $\pm 10.0^\circ$ | Measures lateral torso lean. When seated at a desk where hips are below the table, the system detects this and displays **"Desk Occluded"** rather than failing. |
| **Shoulder Alignment** | Angle of shoulder line (left to right) relative to horizontal | Coronal (Frontal) | $\pm 8.0^\circ$ | Level shoulders read $\sim 0.0^\circ$. Elevated or drooping shoulder triggers deviation. |

- **Aspect Ratio Correction:** All landmark vectors are scaled by physical video dimensions (`videoWidth` $\times$ `videoHeight`) before calculating angles to eliminate 4:3 / 16:9 sensor aspect ratio stretching.
- **Personal Calibration:** Users record a 5-second baseline in their natural upright posture, stored in browser `localStorage`.
- **Temporal Persistence:** Deviations must be continuously sustained for 5.0 seconds before elevating to an alert, eliminating false alarms from momentary natural shifts.
- **Audio Cooldown:** Warning chime enforces a 10-second cooldown period to prevent audio fatigue.

---

## 5. REST API Documentation

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Healthcheck verification |
| `POST` | `/api/sessions` | Persists completed monitoring session and deviation events |
| `GET` | `/api/sessions` | Retrieves historical sessions ordered by `startedAt DESC` |
| `GET` | `/api/sessions/{id}` | Retrieves session details and child events |
| `GET` | `/api/sessions/{id}/insights` | Returns AI-generated or rule-based session reflection |

### Example POST `/api/sessions` Body:
```json
{
  "startedAt": "2026-10-24T00:00:00Z",
  "endedAt": "2026-10-24T00:10:00Z",
  "durationSeconds": 600,
  "totalAlerts": 2,
  "totalEvents": 1,
  "longestSustainedSeconds": 12.5,
  "events": [
    {
      "measurement": "Head / Neck Angle",
      "type": "Sustained Deviation",
      "peakDeviation": 14.2,
      "durationSeconds": 12,
      "baselineValue": 5.0,
      "time": "10:02:13 PM"
    }
  ]
}
```

---

## 6. Generative AI (Google Gemini) Integration

- **Model:** Defaults to official Google Gemini model `gemini-1.5-flash` (configurable via `GEMINI_MODEL`).
- **Server-Side Security:** The API key is configured strictly on the Spring Boot backend (`GEMINI_API_KEY`) and is never exposed to the frontend browser or committed to version control.
- **Network Timeouts:** Configured with a 5-second connect timeout and 15-second read timeout.
- **Safe Fallback:** If `GEMINI_API_KEY` is not provided or if the external API call fails (quota, network, invalid key), the backend automatically falls back to an educational rule-based session reflection.
- **Medical Disclaimer:** All insights are non-medical educational reflections based strictly on recorded metrics.

