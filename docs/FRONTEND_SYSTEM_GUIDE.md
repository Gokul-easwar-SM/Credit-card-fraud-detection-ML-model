# FraudSentinel – Frontend Architecture & UI System Guide

---

## 1. Overview & Technology Stack

The FraudSentinel frontend is an institutional-grade financial intelligence interface designed for both banking fraud analysts and cardholder customers. It combines real-time streaming, interactive graph topology, and explainable AI visualizations in a white-first modern fintech aesthetic.

### Core Technologies
* **Framework:** React 18.3 (Single Page Application)
* **Language & Tooling:** TypeScript 5.6 + Vite 5.4 (sub-second HMR and optimized production bundling)
* **Routing:** React Router DOM 6.28
* **Visualizations:** Recharts 2.13 (ROC/PR curves, confusion matrix) + HTML5 Canvas (Relationship Graph)
* **Styling System:** Modern Vanilla CSS3 Design System (`styles.css`) using CSS custom properties (variables), responsive flex/grid layouts, and zero heavy CSS framework bloat.
* **Real-time Protocol:** Server-Sent Events (SSE) via native `EventSource` with auto-reconnect.
* **Production Hosting:** Render Static Site CDN with SPA rewrite rules (`/* -> /index.html`).

### Visual Palette
* **Canvas White:** `#FFFFFF` (clean financial primary canvas)
* **Ice Silver / Soft:** `#F4F6F8` / `#DCE3E8` (cards, containers, subtle borders)
* **Deep Aubergine:** `#25162F` (typography, high-contrast headers, active state accents)
* **Marigold Gold:** `#E6AD3C` (warnings, high-priority badges, counterfactual highlights)
* **Emerald Green:** `#10B981` (genuine approvals, trust-building indicators)
* **Crimson Red:** `#EF4444` (critical decline, fraud-pushing SHAP bars, frozen card state)

---

## 2. Directory & Component Structure

```
fraudsentinel-frontend/
├── index.html                   # HTML5 Entrypoint with inter/lexend typography
├── package.json                 # Dependencies (React, Recharts, Three, Router)
├── tsconfig.json                # Strict TypeScript configuration
├── vite.config.ts               # Vite build settings & dev server proxy
├── src/
│   ├── main.tsx                 # Route declarations & global providers
│   ├── api.ts                   # Centralized API client & TypeScript interfaces
│   ├── styles.css               # Design system, CSS variables, and animation classes
│   ├── Landing.tsx              # Public executive landing page
│   ├── Customer.tsx             # Customer Simulator, 2-way verification & card freeze
│   └── Analyst.tsx              # Comprehensive analyst workspace (7 modules)
└── dist/                        # Production build output deployed to Render
```

---

## 3. Page Routes & User Journeys

### Route 1: Public Landing Page (`/`)
* **Component:** `Landing.tsx`
* **Purpose:** Introduces the platform to bank stakeholders and academic evaluators.
* **Key Features:**
  * Executive platform overview and core architectural differentiators.
  * System health check and active API status badge.
  * Direct one-click portals to the **Customer Simulator** and **Analyst Workspace**.

### Route 2: Customer Transaction Simulator (`/customer`)
* **Component:** `Customer.tsx`
* **Purpose:** Simulates customer-side card transactions, fraud attacks, and real-time 2-way verification.
* **Key Features:**
  1. **Demo Profile Selection:** Pre-loads **Priya Sharma (`DEMO001`)** with home city Coimbatore and masked card `•••• •••• •••• 9901`.
  2. **5 One-Click Attack & Spend Presets:**
     * `☕ Regular Coffee (₹350)` $\rightarrow$ Routine baseline spend; frictionless approval.
     * `🚨 Impossible Travel (₹98,500)` $\rightarrow$ Delhi online swipe 15 mins after Coimbatore swipe; 1500 km/h anomaly.
     * `⚡ Rapid Velocity Burst (₹28,500)` $\rightarrow$ High-frequency spend spike triggering velocity multipliers.
     * `📱 Unrecognized Device (₹14,500)` $\rightarrow$ Swiped from a new hardware fingerprint never seen on the account.
     * `📍 Unusual Location (₹6,200)` $\rightarrow$ Sudden geo-deviation without physical velocity violation.
  3. **Interactive 2-Way Verification Modal:**
     * Triggers when the decision engine marks a transaction as `VERIFY` or `DECLINE`.
     * Cardholder prompt: *"Did you attempt ₹98,500 at Delhi? Reply YES or NO"*.
     * If cardholder clicks *"❌ No, I did not make this transaction"*:
       * Backend auto-freezes card.
       * UI immediately updates card badge to **FROZEN (Automated Protection Hold Active)**.
       * Event broadcasts across the platform via SSE.

### Route 3: Analyst Portal (`/analyst`)
* **Component:** `Analyst.tsx` (Protected by JWT login at `/analyst/login`)
* **Default Credentials:** Username: `analyst` | Password: `analyst123`
* **The 7 Analyst Workspace Modules:**
  1. **Overview:** Executive KPIs (Live Detection Rate, Volume At Risk ₹, Active Protection Holds, Average Risk Score).
  2. **Live Feed:** Real-time transaction stream via Server-Sent Events (SSE). New transactions appear at the top without page refresh.
  3. **Investigation Queue:**
     * Tabbed filtering (*Pending Review*, *Under Investigation*, *Resolved Cases*).
     * Color-coded 4-tier decision badges (`APPROVE`, `VERIFY`, `REVIEW`, `DECLINE`).
     * Financial Priority Score ($FPS$) sort order ensuring highest monetary exposure is worked first.
     * **1-Click "Export Feedback Dataset (CSV)"** for model retraining and audit archives.
  4. **Case Dossier (`/analyst/investigations/:id`):**
     * **TreeSHAP Feature Attribution Bar Chart:** Red horizontal bars indicate fraud-pushing features (e.g. `speed_kmh`, `amount_ratio_mean`); Green horizontal bars indicate trust-building habits.
     * **Actionable Counterfactual Box:** *"What would need to change for this transaction to be approved?"*
     * **Cold-Start Indicator:** Flags customer history level (`cold_start`, `developing`, `mature`).
     * **Multi-Account Device Warning:** Highlights if the hardware is shared with other customers.
     * **Analyst Action Buttons:** *Confirm Fraud* (initiates chargeback & card freeze) or *Mark Genuine* (whitelists device).
  5. **Cards Management:** Real-time card statuses, limits, and manual freeze/unfreeze toggles.
  6. **Relationship Graph (`/analyst/relationships`):**
     * HTML5 Canvas node-link diagram rendering Customer Nodes (Blue circles) and Device Nodes (Purple diamonds).
     * Edge lines represent financial transactions.
     * Table of **Discovered Mule Ring Clusters** highlighting hardware shared across multiple distinct cardholders (e.g., `DEV-MULE-SHARED-09` linking `CUST00002` and `CUST00003`).
  7. **ML Model Analytics (`/analyst/analytics`):**
     * Interactive ROC Curve ($\text{AUC} = 0.9841$) and Precision-Recall Curve ($\text{PR-AUC} = 0.8519$).
     * Confusion Matrix on 56,962 test transactions.
     * **Live Population Stability Index (PSI) Drift Monitor:** Gauges distribution shifts in real time.
     * **Kaggle Benchmark Display (Pipeline B):** Shows the 284,807 European cardholder dataset with explicit architectural separation callout.

---

## 4. API Client & State Management

In [`src/api.ts`](file:///c:/Users/THANGA%20ANGEL%20M/Desktop/Credit-Card-Fraud-Detection/fraud-system/fraudsentinel-frontend/src/api.ts), the base API URL is determined dynamically:

```typescript
export const BASE: string =
  (typeof window !== "undefined" && localStorage.getItem("fraudsentinel_api_url")) ||
  import.meta.env.VITE_API_URL ||
  (typeof window !== "undefined" && window.location.hostname === "localhost"
    ? "http://localhost:8000"
    : "https://fraudsentinel-lxzr.onrender.com");
```

### Key API Methods
* `api.login(username, password)` $\rightarrow$ Stores JWT in `localStorage` under `fraudsentinel_token`.
* `api.simulate(payload)` $\rightarrow$ `POST /transactions` with 13 behavioral signals.
* `api.relationships()` $\rightarrow$ `GET /relationships/graph` returns node-link JSON and clusters.
* `api.drift()` $\rightarrow$ `GET /metrics/drift` returns Population Stability Index and feature drift.
* `api.kaggleBenchmark()` $\rightarrow$ `GET /metrics/kaggle-benchmark` returns offline dataset comparison.
* `api.respondAlert(alertId, response)` $\rightarrow$ `POST /alerts/:id/respond` (`"yes_me"` or `"not_me"`).
* `useStream(callback)` $\rightarrow$ Subscribes to `GET /stream/transactions` via Server-Sent Events.

---

## 5. Render Deployment Configuration

Configured in `render.yaml` as a **Static Site**:
* **Runtime:** `static`
* **Root Directory:** `fraudsentinel-frontend`
* **Build Command:** `npm install && npm run build`
* **Publish Directory:** `dist`
* **Environment Variable:** `VITE_API_URL = https://fraudsentinel-lxzr.onrender.com`
* **SPA Rewrite Rule:**
  ```yaml
  routes:
    - type: rewrite
      source: /*
      destination: /index.html
  ```
