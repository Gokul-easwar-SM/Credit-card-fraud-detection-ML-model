# FraudSentinel: Adaptive, Explainable & Adversarially-Tested Fraud Detection System

**Academic Prototype for Final-Year B.Tech (AI & Data Science)**  
*Perspective: Bank Fraud Risk & Operations Department*

> **Disclaimer:** This is an academic engineering prototype. It strictly uses synthetic transaction streams and offline public benchmarks. It **never** connects to real bank accounts, **never** blocks real cards, and **never** stores sensitive cardholder PAN, CVV, PIN, or OTP credentials.

---

## 🏆 Project Status & Test Verification

| Module | Scope | Status | Test Coverage |
|---|---|---|---|
| **1. Foundation** | Config, SQLite WAL / PostgreSQL fallback, 11 DB tables, Alembic migrations, `/health` | **Completed** | 28/28 passed |
| **2. ML Pipeline & Benchmark** | 13 behavioral features, LightGBM champion + Isolation Forest blend, Platt calibration, TreeSHAP explainer, offline Kaggle ULB benchmark | **Completed** | 59/59 passed |
| **3. Scoring & Core APIs** | Idempotent transaction scoring (`POST /transactions`), priority queue, JWT analyst auth, audit logging | **Completed** | 48/48 passed |
| **4. Analyst Dashboard (Part B)** | React 18 + TypeScript, priority triage queue, search/filters, TreeSHAP drawer, audit logging | **Completed** | Built (`tsc` + Vite) |
| **5. Customer Portal & Stream (Part A)** | Real-time payment evaluation form, live Server-Sent Events (SSE) ticker | **Completed** | Built (`tsc` + Vite) |
| **6. Two-Way Customer Verification** | Interactive "Was this you?" SMS/push loop (`yes_me` -> genuine, `not_me` -> confirmed fraud) | **Completed** | Built (`tsc` + Vite) |
| **7. Adversarial Simulator & Drift** | 5 live attack injectors, emission rate controls, sliding-window drift telemetry | **Completed** | Built (`tsc` + Vite) |
| **Total Automated Tests** | **107/107 tests passing** (Backend APIs, ML pipeline, features, DB constraints) | **100% Pass** |

---

## 📐 Documentation Index

- [Project Architecture & Engineering Specification](docs/PROJECT_ARCHITECTURE.md)
- [Behavioural Feature Engineering](docs/features.md)
- [Model Governance Card & Benchmark Metrics](docs/model_card.md)
- [Kaggle ULB Offline Benchmark Results](docs/kaggle_benchmark.md)

---

## 🚀 Quickstart Guide (Local Development)

### Prerequisites
- Python 3.11+
- Node.js 18+ & npm

### 1. Launch FastAPI Backend
From the project root:
```powershell
# Navigate to backend directory
cd backend

# Activate virtual environment
..\.venv\Scripts\Activate.ps1

# Run database migrations
alembic upgrade head

# Start FastAPI server on port 8000
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
*Backend endpoints active at `http://localhost:8000` (Interactive Swagger docs: `http://localhost:8000/docs`).*

### 2. Launch React + Vite Frontend
In a second terminal window:
```powershell
# Navigate to frontend directory
cd frontend

# Start Vite development server
npm run dev
```
*Open your browser at `http://localhost:5173`.*

---

## 🔐 Pre-Seeded Academic Credentials

For testing Part B (Analyst Queue & Case Actions), pre-seeded demo accounts are automatically initialized:
- **Analyst:** `username: analyst` / `password: analyst123` (Role: `analyst`)
- **Admin:** `username: admin` / `password: admin123` (Role: `admin`)
*(Quick login presets are accessible directly inside the UI login modal).*

---

## 🧪 Interactive End-to-End Verification Walkthrough

1. **Part A: Customer Payment Submission & Real-Time Scoring**
   - Navigate to the **Customer & Stream** tab.
   - Use the payment form to simulate a checkout. Try entering a normal amount (e.g. ₹850) vs a sudden spike (e.g. ₹95,000) or clicking the *London (Speed Alert)* button.
   - Notice the instant ML evaluation badge, calibrated probability, and actionable counterfactual advice.

2. **Two-Way Customer Verification Loop ("Was this you?")**
   - Transactions evaluated in the medium-risk band automatically trigger an alert in the middle column.
   - Click **"Yes, it was me"**: The system clears the transaction and automatically records the resolution as `marked_genuine`.
   - Click **"No! Fraud"**: The system immediately escalates the incident to `confirmed_fraud` and prioritizes it in the analyst queue.

3. **Live SSE Transaction Stream**
   - Observe the live ticker on the right updating in real time via Server-Sent Events (`/stream`).

4. **Part B: Fraud Analyst Investigation Queue**
   - Click **Analyst Login** (top right) and sign in using `analyst` / `analyst123`.
   - Switch to the **Analyst Queue** tab.
   - Review priority-ranked cases with real-time status pills, risk scores, and customer IDs.
   - Click **Inspect** on any case to open the slide-out drawer:
     - Review the **TreeSHAP local attribution waterfall** (+ risk multipliers in red, - stabilizers in green).
     - Read the natural language explainability reason codes.
     - Add investigation notes and record human decisions (**Mark Genuine**, **Confirm Fraud**, or **Under Investigation**).

5. **Adversarial Attack Injector & Background Generator**
   - Switch to the **Simulator** tab.
   - Start the background stream at 1.0–2.5 Hz to generate synthetic traffic.
   - Click any of the 5 targeted adversarial scenario buttons:
     - **Amount Spike:** 20x spending jump.
     - **Impossible Travel:** High-velocity spatial hop (>600 km/h).
     - **Velocity Burst:** 6 transactions in 60 seconds.
     - **New Device at Night:** Circadian 3:30 AM credential anomaly.
     - **Shared Device Ring:** Single device hoovering across 4 distinct customer accounts.
   - Watch the injected transactions stream live and route directly to the queue.

6. **Model Governance & Runtime Drift Telemetry**
   - Switch to the **Model & Drift** tab.
   - Inspect offline validation PR-AUC (0.7832), ROC-AUC (0.9809), and pattern-specific recall rates.
   - Review the cost optimization matrix ($C_{fp} = ₹50$, $C_{fn} = \text{amount}$).
   - Inspect sliding-window data drift telemetry (high-risk rate, channel distributions, and status health).

---

## 🛠️ Running the Automated Test Suite

```powershell
# Run backend API and integration tests (48 tests)
cd backend
..\.venv\Scripts\python.exe -m pytest -q

# Run full ML, feature engineering, and simulator tests (59 tests)
cd ..
.\.venv\Scripts\python.exe -m pytest -q

# Build frontend production bundle
cd frontend
npm run build
```
*(All 107 repository tests pass with 0 failures).*
