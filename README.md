# HELIOS

> **AI-Powered Smart City Road Intelligence & Emergency Response Platform**  
> *"Intelligent Mobility. Safer Cities."*

---

## 1. Executive Summary

**Helios** transforms everyday electric city buses into mobile, intelligent road-condition monitoring and rapid emergency-response units. By equipping electric buses with **NVIDIA Jetson Nano** edge compute devices connected to forward and rear dashcams, Helios runs computer vision inference directly on board. 

When an anomaly is detected—such as a **traffic collision**, **hazardous pothole**, **monsoon waterlogging**, **faded zebra crossing**, or **traffic bottleneck**—the Jetson device serializes a standardized telemetry event and sends it to the central **Helios Command Center**. 

City administrators and emergency first responders monitor the entire urban transit network through a real-time, interactive **Admin Portal**, enabling automated **Ambulance Dispatches**, **Police Alerts**, and **Municipal Work Orders**.

---

## 2. System Architecture

```
                      ELECTRIC CITY BUS
                              │
                    Dashcam Cameras (Front / Rear)
                              │
                    NVIDIA Jetson Nano (4GB)
                              │
                   Edge AI Computer Vision Models
               (YOLO11, Accident-EdgeNet, WaterSeg)
                              │
                   4G / 5G Cellular Uplink
                    HTTP REST / WebSockets
                              │
                              ▼
                    HELIOS CENTRAL BACKEND
                     (Python 3 / FastAPI)
                              │
        ┌─────────────────────┴─────────────────────┐
        │                                           │
    REST APIs (/api/v1/*)                 Live WebSockets (/ws/events)
  - /buses & /gps                        - incident_created
  - /incidents & /detect                 - sos_created
  - /sos & /analytics                    - bus_updated & gps_updated
        │                                           │
        └─────────────────────┬─────────────────────┘
                              │
                              ▼
                     HELIOS ADMIN PORTAL
             (React 18 + Vite + TypeScript + Tailwind)
```

### Abstraction Layer
The frontend **never** depends directly on raw YOLO weights or physical edge hardware. The FastAPI backend acts as the central abstraction layer, ensuring a stable, standardized event contract.

---

## 3. Standard Event JSON Contract

All edge AI detectors running on bus dashcams submit payloads conforming to this schema:

```json
{
  "id": "INC-001",
  "bus_id": "BUS-1042",
  "event_type": "accident",
  "confidence": 0.97,
  "severity": "high",
  "gps": {
    "lat": 17.4412,
    "lng": 78.3921
  },
  "timestamp": "2026-09-05T09:18:21Z",
  "camera": "front",
  "image_url": "/media/frame123.jpg",
  "video_url": "/media/clip123.mp4",
  "model": "accident-edgenet",
  "status": "detected",
  "notes": "High-impact collision detected on camera front. Bus speed dropped to 0 km/h."
}
```

Supported `event_type` categories: `accident`, `pothole`, `waterlogging`, `road_sign`, `traffic`, `pedestrian`, `divider`.

---

## 4. Repository Structure

```text
helios/
│
├── client/                         # React Admin Dashboard
│   ├── src/
│   │   ├── pages/                  # 16 Complete Command Center Pages
│   │   ├── components/             # Layout, UI components, Modals, Demo Bar
│   │   ├── hooks/                  # useWebSocket, custom hooks
│   │   ├── services/               # API, Buses, Incidents, SOS, Mock Services
│   │   ├── context/                # WebSocketContext, AuthContext
│   │   ├── types/                  # Shared TypeScript type definitions
│   │   └── assets/
│   ├── package.json
│   ├── tailwind.config.js
│   └── vite.config.ts
│
├── server/                         # FastAPI Backend
│   ├── app/
│   │   ├── routes/                 # REST & WebSocket API Routers
│   │   ├── schemas/                # Pydantic Schemas & DTOs
│   │   ├── services/               # Seed Data, Simulator Engine
│   │   ├── websocket/              # ConnectionManager & Broadcast
│   │   ├── database/               # SQLAlchemy Models & SQLite Session
│   │   └── utils/
│   ├── main.py                     # App Lifecycle, CORS, Static Mounting
│   └── requirements.txt
│
├── ai-models/                      # Edge AI Integration Layer
│   ├── accident/                   # Jetson collision detector reference stub
│   ├── pothole/                    # Pavement anomaly detector reference stub
│   ├── waterlogging/               # Flood & puddle segmentation reference stub
│   ├── roadsigns/                  # Road infrastructure reference stub
│   └── README.md
│
├── docs/                           # Architecture specifications & notes
│
└── README.md
```

---

## 5. Required Pages Built

| # | Page | Route | Functionality |
|---|------|-------|---------------|
| 1 | **Login** | `/login` | Futuristic dark theme login with instant demo access credentials. |
| 2 | **Command Overview** | `/overview` | Top statistics, interactive mini map, recent incident feed, and AI health. |
| 3 | **Live City Map** | `/map` | Fullscreen dark Leaflet map with moving buses, incident popups, and layer filters. |
| 4 | **Bus Fleet Monitor** | `/buses` | Grid view of all 20 electric buses with speeds, battery %, driver, and Jetson health. |
| 5 | **Bus Detail** | `/buses/:busId` | Live dual camera streams (front/rear), AI bounding box overlay toggle, and telemetry. |
| 6 | **Incident Center** | `/incidents` | Complete searchable incident registry with status updates (*Investigating*, *Dispatched*, *Resolved*). |
| 7 | **Accidents & SOS** | `/accidents` | High-urgency collision center with *Dispatch Ambulance* and *Notify Police* workflows. |
| 8 | **Camera Center** | `/cameras` | Multi-camera surveillance wall (1080p feeds) with toggleable AI detection boxes. |
| 9 | **Pothole Monitoring** | `/potholes` | Asphalt degradation tracking and municipal repair work-order generation. |
| 10 | **Waterlogging** | `/waterlogging` | Monsoon puddle depth segmentation (cm), road blockages, and traffic diversions. |
| 11 | **Road Assets & Signs** | `/road-signs` | Faded zebra crossing flags, damaged speed signs, and missing dividers. |
| 12 | **Traffic Analytics** | `/traffic` | Multi-class vehicle classification (Cars, Bikes, Buses, Trucks, Pedestrians) with Recharts. |
| 13 | **AI Model Health** | `/ai-models` | Inference latency benchmarks, versioning, confidence scores, and Jetson GPU metrics. |
| 14 | **City Analytics** | `/analytics` | Historical incident curves, corridor risk scores, and date-range filters. |
| 15 | **Notifications** | `/notifications` | Categorized alerts (*Critical*, *Warning*, *Info*) with real-time push sync. |
| 16 | **Settings** | `/settings` | Configurable API endpoints, simulator speed controls, and WebSocket ping tester. |

---

## 6. Smart India Hackathon (SIH) Demonstration Flow

The platform includes an interactive **SIH Demo Controls Bar** at the top of the dashboard:

```
[Simulate Accident]  [Simulate Pothole]  [Simulate Waterlogging]  [Simulate Bus Offline]
```

### The Demonstration Sequence:
1. **Admin Login**: Log in with demo credentials (`admin@helios.local` / `admin123`) or click **Instant SIH Demo Access**.
2. **Overview**: Observe 20 buses (18 online), real-time incident counters, and the live status ticker.
3. **Live Map**: View Hyderabad city transit routes with electric buses moving in real time via the background GPS simulator.
4. **Click "Simulate Accident"**:
   - Backend creates collision incident on `BUS-1042` with 97% confidence.
   - WebSocket broadcasts `sos_created` and `incident_created`.
   - Emergency banner and alert sound modal immediately triggers on the dashboard.
   - A pulsing red alert marker appears on the Live City Map.
   - SOS status displays `SENT`.
5. **Inspect Evidence**: View the camera frame evidence, collision coordinates, and vehicle velocity drop.
6. **Dispatch Response**:
   - Click **Dispatch Ambulance** → Status transitions to `AMBULANCE_DISPATCHED`.
   - Click **Notify Police** → Status transitions to `POLICE_NOTIFIED`.
   - Click **Mark Resolved** → Incident marked as resolved across the database and UI.

---

## 7. Local Setup & Quick Start

### Prerequisites
- Python 3.10+
- Node.js 18+ and npm

### 1. Run the Backend (FastAPI)
```bash
cd server
pip install -r requirements.txt
python -m uvicorn main:app --reload --port 8000
```
- API Base URL: `http://localhost:8000/api/v1`
- Interactive Swagger Docs: `http://localhost:8000/docs`
- WebSocket Endpoint: `ws://localhost:8000/api/v1/ws/events`

### 2. Run the Frontend (React + Vite)
```bash
cd client
npm install
npm run dev
```
- Dashboard URL: `http://localhost:5173`
- Demo Credentials: `admin@helios.local` / `admin123`

---

## 8. Future NVIDIA Jetson Nano Hardware Deployment

When physical Jetson Nano hardware is mounted inside the electric buses:
1. Dashcam connects to Jetson Nano over USB/CSI.
2. TensorRT engine executes YOLO inference on camera frames at 30 FPS.
3. When confidence threshold (>85%) is met, Jetson calls:
   ```http
   POST http://<helios-server>:8000/api/v1/detect/<event_type>
   ```
4. Helios backend validates, persists to database, and broadcasts over WebSockets to all connected command center stations automatically.
