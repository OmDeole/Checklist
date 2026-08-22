# TPM Smart Verify — Proposed Production Architecture & AI Vision Plan

> **Document Version:** 1.0.0  
> **Status:** Proposed Technical Specification & Architecture Design  
> **Target Environment:** On-Premises Company Local Server + Shopfloor Mobile/Tablet Clients (Air-Gapped & Secure)

---

## 1. Architectural Overview & System Design

```
                          ┌─────────────────────────────────────────────────────────┐
                          │               SHOPFLOOR CLIENTS (BROWSER)               │
                          │   Mobile Phones / Tablets / Fixed Station Terminals     │
                          │                                                         │
                          │  • React 19 Frontend (PWA / Responsive)                 │
                          │  • Hardware Camera Access (getUserMedia)                │
                          │  • Anti-Cheat Randomized Step Order Engine              │
                          │  • Offline IndexedDB Queue (Offline Resilience)         │
                          └────────────────────────────┬────────────────────────────┘
                                                       │
                                            HTTP / WebSocket (Intranet)
                                                       │
                          ┌────────────────────────────▼────────────────────────────┐
                          │               ON-PREMISES LOCAL SERVER                  │
                          │               (Inside Plant Network)                    │
                          │                                                         │
                          │  ┌───────────────────────────────────────────────────┐  │
                          │  │           API Gateway / Reverse Proxy             │  │
                          │  │                 (Caddy / Nginx)                   │  │
                          │  └──────────────┬────────────────────┬───────────────┘  │
                          │                 │                    │                  │
                          │  ┌──────────────▼──────┐   ┌─────────▼───────────────┐  │
                          │  │  Backend API Server │   │   MinIO Object Storage  │  │
                          │  │  (FastAPI / Python  │   │  (S3-Compatible Local)  │  │
                          │  │   or Node/Express)  │   │                         │  │
                          │  │                     │   │  • Bucket: tpm-evidence │  │
                          │  │  • Auth & Shifts    │   │  • Image metadata tags  │  │
                          │  │  • Checklist Engine │   │  • Audit trail retention│  │
                          │  │  • Anti-Cheat Logic │   └─────────────────────────┘  │
                          │  │  • Deviation Logs   │                                │
                          │  └──────────┬──────────┘                                │
                          │             │                                           │
                          │    ┌────────┴───────────────┐                           │
                          │    │                        │                           │
                          │ ┌──▼───────────────────┐ ┌──▼────────────────────────┐  │
                          │ │  PostgreSQL Database │ │ AI Vision Inference Svc   │  │
                          │ │  (Relational + Logs) │ │ (Gauge & Pokayoke CV/VLM) │  │
                          │ │                      │ │                           │  │
                          │ │ • Checklists         │ │ • YOLOv8 Gauge Detector   │  │
                          │ │ • Shift Logs         │ │ • Angle/Needle Bar Calc   │  │
                          │ │ • Audit & Deviations │ │ • PaddleOCR / Local VLM   │  │
                          │ └──────────────────────┘ └───────────────────────────┘  │
                          └─────────────────────────────────────────────────────────┘
```

---

## 2. Why On-Premises Central Server AI (vs Pure Edge AI on Phone)

You asked whether we should use **Edge AI** (on the mobile device) or host the model on the **company local server**:

### Recommended Decision: **On-Premises Local Server AI Inference**
| Factor | On-Prem Local Server (Recommended) | Pure Edge AI (On Mobile Phone/Browser) |
| :--- | :--- | :--- |
| **Data Privacy** | 100% Local (Zero data leaves plant intranet) | 100% Local |
| **Device Hardware** | Server has standard GPU/CPU; consistent <300ms speed | Cheap shopfloor Android tablets lag or run out of RAM |
| **Battery & Thermal** | Phones stay cool; no heavy WebGL/WASM computation | High battery drain & phone overheating on shop floors |
| **Model Updates** | Update model once on server; all stations get it instantly | Must re-download 200MB–2GB models to every operator device |
| **Accuracy** | Can run robust models (e.g. YOLOv8 + PaddleOCR or Qwen2.5-VL-7B) | Restricted to tiny quantized models (MobileNet) with lower accuracy |

---

## 3. Computer Vision & AI Verification Strategy

### 3.1 Case 1: Analog Pressure Gauge Verification (e.g. 4 – 6 bar)
When an operator takes a picture of the main air pressure gauge:

```
[Captured Photo]
       │
       ▼
[1. YOLOv8 Object Detection] ───> Localizes & crops the circular gauge dial
       │
       ▼
[2. Circle Normalization] ──────> Transforms perspective to face-on circular polar coordinates
       │
       ▼
[3. Needle Angle & Scale Mapping]
   - Detects needle vector via Hough Line Transform or Keypoint Regression
   - Reads zero-mark angle ($0\text{ bar}$) and max-mark angle (e.g., $10\text{ bar}$)
   - Calculates $\text{Pressure} = \frac{\theta_{\text{needle}} - \theta_{\text{min}}}{\theta_{\text{max}} - \theta_{\text{min}}} \times \text{Scale}_{\text{max}}$
       │
       ▼
[4. Automated Tolerance Check]
   - Is $4.0 \le \text{Detected Pressure} \le 6.0$?
   - **IF YES (e.g., 5.1 bar):** Status automatically marked **`OK`** with green bounding box.
   - **IF NO (e.g., 3.2 bar):** Status automatically flagged **`NOT_OK`**, station stopped, and deviation form pre-populated with:  
     `"AI Detected Pressure: 3.2 bar (Tolerance: 4.0 - 6.0 bar)"`.
```

#### Alternative: Multimodal Local VLM (Zero-Shot)
On a local server with an NVIDIA GPU (RTX 3060/4060 or higher), we can run a lightweight local Vision-Language Model (such as **Qwen2.5-VL-7B-Instruct** or **Moondream2 / Florence-2**) via **vLLM** or **Ollama**:
```json
// Prompt:
"Analyze this machine gauge photo. What is the exact reading shown and its unit? Is it between 4 and 6 bar? Return JSON: {\"reading\": float, \"unit\": string, \"is_within_range\": bool, \"confidence\": float}"
```

### 3.2 Case 2: Pokayoke Sensor / Part Presence Verification
1. **LED Status Inspection:** Color thresholding / CNN classification to verify sensor LED state (Green = Engaged / Red = Blocked).
2. **Red Bin Inspection:** Object detection to confirm the red scrap bin is completely empty before shift start.
3. **Safety Curtain Laser Check:** Verifies sensor alignment lights are active.

---

## 4. MinIO Object Storage Configuration

MinIO runs locally as a high-performance, S3-compatible object store.

### 4.1 Stock Configuration Details
- **MinIO API Port:** `http://127.0.0.1:9000`
- **MinIO Console Port:** `http://127.0.0.1:9001`
- **Default Stock Credentials:**
  - `MINIO_ROOT_USER`: `minioadmin`
  - `MINIO_ROOT_PASSWORD`: `minioadmin`

### 4.2 Bucket & Directory Structure
```
tpm-evidence/
 └── raw/
      └── {YYYY}/{MM}/{DD}/
           └── MF2/
                └── LINE2/
                     └── ST130/
                          └── {submission_hash}_{checkpoint_id}_{timestamp}.jpg
 └── verified/
      └── ... (watermarked & AI annotated images with bounding box overlays)
```

### 4.3 Upload & Serving Workflow
1. Client takes photo -> compresses to JPEG.
2. Backend generates a Presigned Upload URL or receives `multipart/form-data`.
3. Backend uploads image stream directly to MinIO bucket with custom metadata:
   - `x-amz-meta-operator-id`: `OP-9041`
   - `x-amz-meta-station-id`: `130`
   - `x-amz-meta-checkpoint-id`: `m2`
   - `x-amz-meta-gps-lat`: `18.52043`
   - `x-amz-meta-gps-lng`: `73.85674`
   - `x-amz-meta-ai-verified`: `true`
   - `x-amz-meta-ai-reading`: `5.2 bar`

---

## 5. Recommended Backend Technology Stack

### Option A: **Python FastAPI** (Recommended for AI + MinIO + CV integration)
- **Framework:** FastAPI (Asynchronous, High-Performance, Auto OpenAPI documentation)
- **Database ORM:** SQLAlchemy 2.0 / SQLModel + Alembic migrations
- **Database:** PostgreSQL (or SQLite for single-node zero-config)
- **MinIO SDK:** `minio-py`
- **CV / AI Engine:** OpenCV (`cv2`), PyTorch / ONNX Runtime, Ultralytics YOLOv8, or vLLM / Ollama client.
- **Why it fits:** Native integration with Python computer vision and machine learning libraries without needing multi-process IPC bridges.

### Option B: **Node.js + Express / Fastify (TypeScript)**
- **Framework:** Express / Fastify with TypeScript
- **MinIO SDK:** `@aws-sdk/client-s3` or `minio` npm package
- **Database ORM:** Prisma or Drizzle ORM
- **CV Engine:** Spawns Python sidecar microservice or calls ONNX Runtime Node.

---

## 6. Database Schema (PostgreSQL / Relational)

```sql
-- Minifactories
CREATE TABLE minifactories (
    id VARCHAR(32) PRIMARY KEY,
    name VARCHAR(128) NOT NULL
);

-- Lines
CREATE TABLE production_lines (
    id VARCHAR(32) PRIMARY KEY,
    minifactory_id VARCHAR(32) REFERENCES minifactories(id),
    name VARCHAR(128) NOT NULL
);

-- Stations
CREATE TABLE stations (
    id VARCHAR(32) PRIMARY KEY,
    line_id VARCHAR(32) REFERENCES production_lines(id),
    station_number VARCHAR(16) NOT NULL,
    name VARCHAR(128) NOT NULL,
    geofence_lat DOUBLE PRECISION,
    geofence_lng DOUBLE PRECISION,
    geofence_radius_meters INTEGER DEFAULT 50
);

-- Master Checkpoints Definition
CREATE TABLE checkpoint_definitions (
    id VARCHAR(32) PRIMARY KEY,
    station_id VARCHAR(32) REFERENCES stations(id),
    kind VARCHAR(16) NOT NULL, -- 'MACHINE' or 'POKAYOKE'
    sn VARCHAR(8) NOT NULL,
    title TEXT NOT NULL,
    model VARCHAR(64),
    standard_spec TEXT NOT NULL,
    verify_method TEXT,
    frequency VARCHAR(64) NOT NULL,
    photo_required BOOLEAN DEFAULT TRUE,
    required_photo_count INTEGER DEFAULT 1,
    ai_check_type VARCHAR(32), -- 'ANALOG_PRESSURE_GAUGE', 'DIGITAL_OCR', 'PART_PRESENCE', 'NONE'
    ai_min_val DOUBLE PRECISION,
    ai_max_val DOUBLE PRECISION,
    ai_unit VARCHAR(16)
);

-- Checklist Submissions (Per Shift)
CREATE TABLE checklist_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    station_id VARCHAR(32) REFERENCES stations(id),
    operator_id VARCHAR(64) NOT NULL,
    operator_name VARCHAR(128) NOT NULL,
    shift_name VARCHAR(64) NOT NULL,
    started_at TIMESTAMP WITH TIME ZONE NOT NULL,
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    overall_status VARCHAR(32) NOT NULL, -- 'COMPLETED', 'DEVIATION_STOPPED'
    submission_hash VARCHAR(128) NOT NULL,
    gps_lat DOUBLE PRECISION,
    gps_lng DOUBLE PRECISION,
    gps_is_within_geofence BOOLEAN NOT NULL
);

-- Checkpoint Results & AI Verifications
CREATE TABLE checkpoint_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id UUID REFERENCES checklist_submissions(id) ON DELETE CASCADE,
    checkpoint_id VARCHAR(32) REFERENCES checkpoint_definitions(id),
    status VARCHAR(16) NOT NULL, -- 'OK', 'NOT_OK'
    checked_at TIMESTAMP WITH TIME ZONE NOT NULL,
    notes TEXT,
    ai_detected_val DOUBLE PRECISION,
    ai_confidence DOUBLE PRECISION,
    ai_flagged_deviation BOOLEAN DEFAULT FALSE,
    ai_raw_output JSONB
);

-- Photos & Evidence
CREATE TABLE photo_evidence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    result_id UUID REFERENCES checkpoint_results(id) ON DELETE CASCADE,
    minio_bucket VARCHAR(64) NOT NULL,
    minio_object_key TEXT NOT NULL,
    file_size_bytes INTEGER,
    captured_at TIMESTAMP WITH TIME ZONE NOT NULL,
    gps_lat DOUBLE PRECISION,
    gps_lng DOUBLE PRECISION,
    watermark_hash VARCHAR(128)
);

-- Deviations / Reaction Plans
CREATE TABLE deviation_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id UUID REFERENCES checklist_submissions(id),
    station_id VARCHAR(32) REFERENCES stations(id),
    checkpoint_name TEXT NOT NULL,
    problem_description TEXT NOT NULL,
    owner VARCHAR(128) NOT NULL,
    countermeasure TEXT NOT NULL,
    target_date DATE NOT NULL,
    status VARCHAR(32) NOT NULL, -- 'Open', 'In Progress', 'Resolved'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE
);
```

---

## 7. Offline Resilience & Shopfloor Network Tolerance

Shopfloors frequently have Wi-Fi dead spots (behind CNC enclosures or steel beams).
1. **Local IndexedDB Buffer:** If network disconnects while the operator is on Step 3:
   - High-res watermarked images and checkpoint results store in IndexedDB.
   - UI shows `"Offline Buffer (Syncs automatically when Wi-Fi returns)"`.
2. **Background Sync:** As soon as device reconnects, the batch submits and pushes to MinIO and PostgreSQL.

---

## 8. Questions for Discussion & Next Action Steps

To prepare the exact backend scaffolding and AI model integration:

1. **Server Hardware Specs:**
   - Does your local computer / on-prem server have a dedicated GPU (e.g. NVIDIA RTX series) or CPU only?
   - *(If CPU only: We will configure lightweight ONNX / OpenCV gauge reading; if GPU: We can also enable local Vision-Language Models).*
2. **MinIO Status:**
   - Is MinIO currently running on `http://127.0.0.1:9000` with default `minioadmin / minioadmin`?
3. **Paper Checklist Photos:**
   - Whenever you are ready to share the photos of the manual paper checklists, we can extract the exact checkpoint names, tolerances, frequencies, and station mapping into the database seed files!

---

*This document outlines the end-to-end technical plan for the production deployment.*
