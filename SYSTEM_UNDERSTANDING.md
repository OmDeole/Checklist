 .# TPM Smart Verify — System Understanding & Repository Context

> **Document Version:** 1.0.0  
> **Target Audience:** Development Agents, Engineers, and System Architects  
> **System Purpose:** Digital Total Productive Maintenance (TPM) & Pokayoke Error-Proofing Verification Platform for Manufacturing Shop Floors with Anti-Falsification Controls.

---

## 1. Executive Summary & Core Function

This repository is the frontend application for **TPM Smart Verify** (formerly paper-based shopfloor checklists). 

In high-precision manufacturing plants (machining, sub-assembly, pump assembly lines, motor winding), operators must execute daily/per-shift checks on machines and **Pokayoke (error-proofing)** sensors before starting production. In paper checklists, operators frequently "tick-box" or back-date without actually inspecting the machine (known as checklist falsification).

This system digitizes the checklist process with built-in **anti-cheat / anti-falsification mechanisms**:
1. **Randomized Step Order:** Checkpoints appear in randomized sequence per session so operators cannot memorize repetitive click patterns.
2. **Mandatory Live Hardware Camera Capture:** Disables gallery image uploads; requires real-time camera viewfinder captures.
3. **Cryptographic & Visual Watermarking:** Burns station ID, timestamp, GPS coordinates, operator ID, and verification hashes directly onto photos and digital submissions.
4. **Immediate Station Stop on Deviation:** Out-of-spec readings (e.g. pressure < 4 bar) automatically trigger a "STATION STOPPED" status and open a **Reaction Plan & Countermeasure Log**.
5. **Real-time Plant Dashboard:** Supervisors can monitor all stations, lines, and minifactories with live status indicators and audit records.

---

## 2. Technical Stack (Frontend)

- **Framework:** React 19 + TypeScript
- **Build Tool:** Vite 6.2.3
- **Styling:** TailwindCSS 4 (via `@tailwindcss/vite`) + Custom Glassmorphism UI
- **Icons:** `lucide-react`
- **Animation:** `motion`
- **Current Storage:** Client-side `localStorage` (`tpm_minifactories_data_v4`)
- **Location & Geofencing:** HTML5 Geolocation API with Haversine distance calculations against factory geofence reference coordinates.

---

## 3. Repository Directory Structure

```
Checklist/
├── src/
│   ├── components/
│   │   ├── Navbar.tsx             # Top navigation, minifactory switch, shift & live GPS indicator
│   │   ├── OperatorChecklist.tsx  # Core operator workflow (Card & List views, auto-advance, shuffle)
│   │   ├── Dashboard.tsx          # Plant supervisor overview, station status matrix, deviation log
│   │   ├── CameraModal.tsx        # Live camera viewfinder, canvas watermarking (GPS/time/hash)
│   │   ├── DeviationModal.tsx     # Reaction plan form when a check fails (owner, countermeasure, target date)
│   │   └── AuditDetailModal.tsx   # Inspection record inspector with full photo evidence gallery
│   ├── data/
│   │   └── initialData.ts         # Seed data for Minifactories (MF1, MF2, MF3), lines, stations, standards
│   ├── utils/
│   │   └── geolocation.ts        # Geofencing calculations, shift determination (Shift 1, 2, 3), timestamp formatting
│   ├── types.ts                   # Core domain TypeScript interfaces and types
│   ├── App.tsx                    # Root state coordinator, view switching, toast alerts
│   ├── main.tsx                   # React entry point
│   └── index.css                  # Tailwind styles
├── index.html                     # HTML shell
├── package.json                   # Dependencies and scripts
└── vite.config.ts                 # Vite bundler configuration
```

---

## 4. Domain Data Model & Key Types (`src/types.ts`)

### 4.1 Hierarchy
```
Minifactory (e.g. MF2 - Pump Assembly)
 └── Line (e.g. MF2-LINE2: Pump Assembly Line 2)
      └── Station (e.g. Station 130: Main Pump Assembly & Pokayoke Verification)
           ├── MachineCheckpoints[] (e.g. Air pressure 4-6 bar, Cleanliness, Red bin)
           ├── PokayokeCheckpoints[] (e.g. Sensor Part Presence, Clamp Lock, Screwing Gun)
           └── Deviations[] (DeviationLog / Reaction Plan entries)
```

### 4.2 Checkpoint Types

#### `MachineCheckpoint`
- `sn`: Sequential number (1, 2, 3...)
- `checkPoint`: Name of check (e.g. "Check main air pressure", "Check safety curtain is working")
- `standard`: Target tolerance (e.g. "4 - 6 bar", "0.2 - 0.4 Mpa", "No dust", "operation stops")
- `freq`: Frequency (e.g. "Per shift/ Setup (After 4 Hrs)")
- `photoRequired`: Boolean flag requiring camera capture
- `status`: `'OK' | 'NOT_OK' | 'PENDING'`
- `photos`: `PhotoEvidence[]`

#### `PokayokeCheckpoint` (Poka-Yoke / Error Proofing)
- `sn`: Letter designation ('A', 'B', 'C', 'D', 'E')
- `pokayoke`: Sensor or interlock name (e.g. "Sensor for Part Presence", "Barcode interlink")
- `verifyMethod`: Test procedure (e.g. "Skip part loading", "change gun home position")
- `photoRequirementLabel`: e.g. "Before and after photo" (requires 2 photos), "Yes" (1 photo)
- `requiredPhotoCount`: 1 or 2 photos required

#### `PhotoEvidence`
- `dataUrl`: Base64 JPEG with burnt-in visual watermark banner
- `timestamp`: ISO timestamp
- `location`: Geocoordinates `{ latitude, longitude, accuracy, isWithinGeofence }`
- `operatorId`: ID of operator submitting photo
- `stationId`: Station number

#### `DeviationLog` (Reaction Plan)
- `problemDescription`: Details of failure
- `owner`: Person responsible for countermeasure (e.g. "R. Sharma (Maintenance Lead)")
- `countermeasure`: Immediate or corrective action
- `targetDate`: Target resolution date
- `status`: `'Open' | 'In Progress' | 'Resolved'`

---

## 5. Detailed Component Breakdown

### 5.1 `OperatorChecklist.tsx` (Operator Mobile/Tablet UI)
- **Anti-Cheat Step Shuffling:** On station selection, `DEFAULT_STATION_130_MACHINE_CHECKPOINTS` and `DEFAULT_STATION_130_POKAYOKE_CHECKPOINTS` are combined and shuffled into `shuffledStepKeys`.
- **View Modes:**
  - `mobile_step` (Card View): High-focus single-card flow with auto-advance upon selecting `OK` and taking required photos.
  - `guided_list` (Lean List View): Scrollable overview with inline status buttons and snapshot shortcuts.
- **Validation Engine:** Before submission, blocks submission if any checkpoint is `PENDING` or missing mandatory live photos.
- **Auto Deviation Trigger:** Marking any item `NOT_OK` opens `DeviationModal` and marks the station as `DEVIATION_STOPPED`.

### 5.2 `CameraModal.tsx` (Hardware Capture & Watermarking)
- Directly calls `navigator.mediaDevices.getUserMedia` with rear-camera default (`facingMode: 'environment'`).
- Renders live video into an off-screen HTML5 `<canvas>` (1280x720).
- Applies an opaque bottom watermark bar containing:
  - Security header: `SECURITY WATERMARK: REAL-TIME TPM VERIFICATION`
  - Real-time timestamp
  - Latitude, Longitude, and GPS accuracy in meters
  - Minifactory name, Line name, Station number, Operator ID, Verification Hash
  - Disclaimer: `✔ NO GALLERY SELECTION • DIRECT HARDWARE CAPTURE`
- Fallback simulation canvas available when running in environments without camera devices (useful for local development).

### 5.3 `Dashboard.tsx` (Plant Monitoring & Auditing)
- Displays aggregated KPIs: Shift Completion %, Active Station Stops, Total Photos Attached, Current Shift.
- Minifactory and Line selectors.
- Live Station Matrix with status pills (`COMPLETED`, `STATION STOPPED`, `IN PROGRESS`).
- Plant-Wide Reaction Plan Table showing all deviations, assigned owners, and countermeasure statuses.
- Direct drill-down into `AuditDetailModal.tsx`.

### 5.4 `geolocation.ts` (Location & Shift Rules)
- Defines factory geofence reference (`18.52043 N, 73.85674 E`, 50m radius).
- Calculates 3-shift rotation:
  - **Shift 1:** 06:00 – 14:00
  - **Shift 2:** 14:00 – 22:00
  - **Shift 3:** 22:00 – 06:00
- Computes Haversine distance to verify whether the mobile device is physically located inside the shopfloor boundary.

---

## 6. Identified Gaps & Missing Backend Infrastructure

Currently, the system is purely client-side:
1. **Image Storage:** Images are stored as Base64 strings in `localStorage`, which hits quota limits quickly (5MB browser limit).
2. **Persistence:** No centralized database for historical records, shifts, or multiple plant synchronizations.
3. **No AI Gauge / Pokayoke Verification:** The operator manually selects `OK` or `NOT_OK`. There is no automated computer vision checking whether the gauge in the photo actually reads 4–6 bar, or whether a part is present.
4. **No On-Premises API / Central Storage:** A local MinIO bucket and backend server (Node/FastAPI/Go) are needed.

---

*This document serves as the permanent ground truth context for this repository.*
