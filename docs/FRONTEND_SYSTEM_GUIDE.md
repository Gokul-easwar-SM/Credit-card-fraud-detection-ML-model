# FraudSentinel – Frontend Architecture & UI System Guide

**System Component:** Single-Page Financial Intelligence Dashboard  
**Framework:** React 18.3 + TypeScript 5.6 + Vite 5.4 · Port 5173  
**Mapping Engine:** Leaflet 1.9 + OpenStreetMap / Esri Tiles

---

## 1. Overview & Technology Stack

The FraudSentinel frontend is an institutional-grade financial intelligence interface designed for bank fraud analysts and risk operations teams. It combines real-time streaming, interactive Leaflet GIS mapping, and explainable AI visualizations in a modern financial design system.

### Core Technologies
* **Framework:** React 18.3 (Single Page Application)
* **Language & Tooling:** TypeScript 5.6 + Vite 5.4 (sub-second HMR and optimized production bundling)
* **Routing:** React Router DOM 6.28
* **GIS Mapping Engine:** **Leaflet 1.9 + OpenStreetMap & Esri GIS tiles** (100% free, zero external API keys, zero watermarks, street-level resolution across India)
* **Visualizations:** Recharts 2.13 (ROC/PR curves, confusion matrix, financial priority distributions) + Three.js / React Three Fiber (3D interactive card rendering on landing page)
* **Styling System:** Modern Vanilla CSS3 Design System (`styles.css`) using CSS variables, responsive flex/grid layouts, and zero framework overhead.
* **Real-time Protocol:** Server-Sent Events (SSE) via native `EventSource` with auto-reconnect and standardized event envelopes.
* **Production Hosting:** Render Static Site CDN with SPA rewrite rules (`/* -> /index.html`).

---

## 2. Directory & Component Structure

```
fraudsentinel-frontend/
├── index.html                   # HTML5 Entrypoint with inter/lexend typography
├── package.json                 # Dependencies (React, Recharts, Three, Leaflet, Router)
├── tsconfig.json                # Strict TypeScript configuration
├── vite.config.ts               # Vite build configuration
├── src/
│   ├── main.tsx                 # Route declarations & global providers
│   ├── api.ts                   # Centralized API client, TypeScript interfaces, and useStream hook
│   ├── styles.css               # Design system, CSS variables, and animation classes
│   ├── Landing.tsx              # Executive institutional landing page with 3D Canvas
│   ├── BankEventSimulator.tsx   # Bank-side payment switch controller & 7 demo scenarios
│   ├── TransactionMap.tsx       # Leaflet OpenStreetMap GIS radar component
│   └── Analyst.tsx              # Comprehensive analyst operations suite (7 sub-modules)
└── dist/                        # Production build output
```

---

## 3. Page Routes & User Journeys

### Route 1: Executive Landing Page (`/`)
* **Component:** `Landing.tsx`
* **Purpose:** Introduces FraudSentinel as an enterprise bank-side fraud prevention system.
* **Key Features:**
  * 3D Canvas card visualization rendered via Three.js.
  * Executive overview of bank switch ingestion, behavioral analytics, and explainable AI.
  * Direct portals to the **Analyst Operations Center** (`/analyst`) and **Bank Switch Simulator** (`/simulator`).

### Route 2: Bank Switch Event Controller (`/simulator`)
* **Component:** `BankEventSimulator.tsx` (Legacy `/customer` route redirects here)
* **Purpose:** Acts as the internal bank payment switch generator for testing and academic demonstration.
* **Key Features:**
  1. **7 One-Click Controlled Demo Scenarios**:
     * `1. Normal Transaction (Usual Location)`: Aarav Patel ₹450 coffee in Coimbatore $\rightarrow$ Approved (<15% risk).
     * `2. High-Value at Unusual Location`: Aarav Patel ₹85,000 at Delhi Luxury Jewelers $\rightarrow$ Flagged for Review (>75% risk).
     * `3. Stolen-Card in Another City`: Aarav Patel ₹48,000 in Mumbai $\rightarrow$ Flagged for Review (>70% risk).
     * `4. Impossible Travel Velocity`: Swiped in Bengaluru 15 min after Coimbatore (1,441 km/h) $\rightarrow$ Critical Speed Flag.
     * `5. New Device & Unusual Location`: Online ₹24,000 swipe on unmapped IP $\rightarrow$ Step-Up Verification.
     * `6. High Transaction Velocity`: 4 rapid ATM withdrawals in 3 minutes $\rightarrow$ Velocity Burst Flag.
     * `7. Normal Spend at New Location (Legitimate Travel)`: Lunch in Bengaluru 5 hours later (60 km/h) $\rightarrow$ Approved (<25% risk).
  2. **Custom Bank Switch Event Builder**:
     * Select persistent cardholders (`DEMO001`, `CUST00001` through `CUST00005`).
     * Inspect verified baseline spending profile and historical transaction count.
     * Select payment channel (**POS**, **ATM**, or **Online**).
     * For POS/ATM: Choose certified hardware terminal from the registry; coordinates and merchant details auto-populate.
     * For Online: Choose payment gateway and cardholder client IP subnet; IP geolocation is resolved automatically.
  3. **Continuous Background Stream Controller**:
     * Start/Stop 1.0 Hz automated switch transaction feed.

### Route 3: Analyst Operations Portal (`/analyst`)
* **Component:** `Analyst.tsx` (Requires login: `analyst / analyst123`)
* **Sub-Modules:**
  1. **Overview (`/analyst`)**: Executive KPIs, model health metrics (ROC-AUC 0.9889, p95 Latency 1.8 ms), and risk volume distributions.
  2. **Live Feed (`/analyst/live`)**:
     * Real-time SSE stream table.
     * Embedded **Leaflet OpenStreetMap GIS Radar** plotting incoming transactions, route vectors, and travel speeds in real time.
     * Click any row to focus the map and inspect telemetry.
  3. **Investigation Queue (`/analyst/queue`)**: Priority-ranked triage queue sorted by Financial Priority Score ($\text{FPS} = \text{Amount} \times P(\text{Fraud})$).
  4. **Investigation Dossier (`/analyst/investigations/:id`)**:
     * Embedded interactive Leaflet GIS map with route polylines.
     * Geospatial & Terminal Intelligence Panel (hardware terminal ID, merchant category, coordinates, distance, speed).
     * Customer Behavioral Baseline (32 prior transactions, home corridor, spend norms, typical hours, common channels).
     * Bidirectional TreeSHAP Attribution (factors increasing risk vs factors reducing risk).
     * MSG91 Customer Fraud Notification Status card.
     * Analyst Decision Actions (`Mark Genuine`, `Mark Suspicious`, `Request Step-Up Verification`, `Escalate Case`, `Temporarily Lock Card`, `Confirm Fraud`).
  5. **Card Security Portfolio (`/analyst/cards`)**: View card statuses and toggle simulated locks.
  6. **Relationship Graph (`/analyst/relationships`)**: HTML5 canvas graph visualizing shared devices and fraud rings.
  7. **ML Model Analytics (`/analyst/analytics`)**: Interactive ROC-AUC curves, PR curves, feature importance bar charts, and confusion matrix.
