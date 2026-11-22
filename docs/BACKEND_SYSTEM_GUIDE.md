# FraudSentinel – Backend Architecture & Engine System Guide

**System Component:** FastAPI Asynchronous REST Engine & Real-Time Broker  
**Runtime:** Python 3.11 · Port 8000  
**Storage Architecture:** Thread-Safe In-Memory State Engine (`memory_store.py`)

---

## 1. Overview & Technology Stack

The FraudSentinel backend is an enterprise-grade asynchronous REST API and real-time streaming engine built for high-throughput transaction scoring, automated risk policy enforcement, explainable AI attribution, and geospatial intelligence.

### Core Technologies
* **Language & Runtime:** Python 3.11 (optimized typing, dataclasses, and math libraries)
* **Web Framework:** FastAPI 0.115+ (Asynchronous ASGI framework with auto-generated OpenAPI 3.0 / Swagger docs)
* **Application Server:** Uvicorn 0.30+ (High-performance ASGI server binding to `$PORT` on Render)
* **Storage Architecture:** **Zero-Database In-Memory State Engine** (`MemoryStore`) with thread-safe `RLock` synchronization. Eliminates SQLite concurrency locks, connection pooling overhead, and database setup errors.
* **Geospatial Engine:** Spherical Haversine distance and transit velocity calculator integrated with physical hardware terminal registry.
* **Authentication:** JWT (JSON Web Tokens via PyJWT) with salted password hashing (Bcrypt) and Role-Based Access Control (RBAC: `analyst`, `admin`, `auditor`).
* **Real-Time Streaming:** Asynchronous pub/sub broker broadcasting Server-Sent Events (SSE) to active frontend clients with automatic keep-alive pings.
* **Safe Telephony Fallback:** Dual-mode SMS service (Automatic simulation fallback by default; real MSG91 API gateway active when `MSG91_AUTH_KEY` is present).

---

## 2. Directory Structure

```
backend/
├── requirements.txt             # Production dependencies (FastAPI, Uvicorn, LightGBM, scikit-learn, SHAP, PyJWT)
├── app/
│   ├── main.py                  # Application entrypoint, lifespan startup, CORS, router registration
│   ├── core/
│   │   ├── config.py            # Pydantic BaseSettings (APP_ENV, SECRET_KEY, MSG91 credentials)
│   │   ├── logging.py           # Structured JSON and console logging configuration
│   │   └── security.py          # Password hashing, JWT creation, bearer token verification
│   ├── db/
│   │   ├── memory_store.py      # High-performance thread-safe in-memory state engine (seeded with deep history)
│   │   ├── models.py            # Preserved SQLAlchemy schema models (retained for schema documentation)
│   │   └── session.py           # Fallback session handlers
│   ├── ml/
│   │   ├── artifacts/           # Model binaries: model.joblib, thresholds.json, features.json, metrics.json
│   │   ├── features.py          # 13 point-in-time behavioral feature extraction functions
│   │   ├── explain.py           # TreeSHAP explainer and plain-English counterfactual generators
│   │   └── pipeline.py          # TrainedPipeline and ScoreCalibrator wrappers
│   ├── schemas/                 # Pydantic v2 schemas for request validation & serialization
│   │   ├── transaction.py       # TransactionCreate, TransactionResponse, Geospatial fields
│   │   ├── customer.py          # CustomerProfile, BaselineSummary, CardStatus
│   │   ├── investigation.py     # InvestigationUpdate, AnalystDecision, FeedbackExport
│   │   └── alert.py             # AlertResponse, CustomerResponseRequest
│   └── services/
│       ├── scoring.py           # Ingestion, feature computation, geospatial analysis, ML inference
│       ├── terminal_registry.py # Certified POS/ATM hardware registry and IP subnet resolver
│       ├── simulator_service.py # Bank payment switch generator (7 controlled scenarios & 1 Hz stream)
│       ├── stream_service.py    # SSE broadcaster queue management
│       └── sms_service.py       # Dual-mode customer SMS dispatcher
└── tests/
    └── test_bank_scenarios.py   # Complete test suite covering all 7 banking demonstration scenarios
```

---

## 3. Core API Endpoints

### A. Transaction & Simulator APIs
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/v1/simulator/scenario` | Injects one of the 7 pre-packaged controlled banking scenarios into the scoring pipeline. |
| `POST` | `/api/v1/simulator/event` | Ingests a custom ISO 8583 / JSON bank switch payload, auto-resolves hardware terminal / IP geolocation, and scores the event. |
| `GET` | `/api/v1/simulator/status` | Reports whether the automated background bank switch stream is active. |
| `POST` | `/api/v1/simulator/start` | Starts the background bank switch transaction generator (default 1.0 Hz). |
| `POST` | `/api/v1/simulator/stop` | Stops the background bank switch transaction generator. |
| `GET` | `/api/v1/simulator/terminals` | Returns the certified hardware terminal and ATM registry. |
| `GET` | `/api/v1/transactions` | Lists buffered transactions with pagination and risk filtering. |
| `GET` | `/api/v1/transactions/{id}` | Retrieves full transaction detail including geospatial vectors, TreeSHAP drivers, and customer baseline. |

### B. Investigation & Response APIs
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/investigations` | Retrieves investigation queue triage items with filtering by status, search, and priority score. |
| `GET` | `/api/v1/investigations/{id}` | Returns comprehensive investigation dossier including customer history summary and SMS alert state. |
| `POST` | `/api/v1/investigations/{id}/decision` | Saves analyst human review decision (`marked_genuine`, `under_investigation`, `step_up_requested`, `escalated`, `confirmed_fraud`). |
| `POST` | `/api/v1/investigations/{id}/lock-card` | Toggles temporary simulated core banking card freeze/unfreeze in the ledger. |
| `GET` | `/api/v1/investigations/export-feedback` | Exports analyst review outcomes as a verified retraining dataset. |

### C. Streaming & Monitoring APIs
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/stream/transactions` | Server-Sent Events (SSE) stream broadcasting `{event_type: "transaction_scored", data: ...}` and `{event_type: "alert_dispatched", data: ...}`. |
| `GET` | `/health` | System health check reporting active ML model, memory store records, and pipeline latency. |

---

## 4. Persistent Customer Memory Store & Seeding

The in-memory engine seeds stable customer records on startup:
* **`DEMO001` (Aarav Patel)**: Coimbatore resident with 32 historical transactions spanning 28 days. Baseline average spend is ₹1,250 ($\sigma \approx 420$), active POS swipe history at Annapoorna Restaurant and Starbucks RS Puram.
* **`CUST00001` (Priya Sharma)**: Chennai resident, baseline average spend ₹1,850.
* **`CUST00002` (Vikram Malhotra)**: Bengaluru resident, baseline average spend ₹3,200.
* **`CUST00003` (Neha Gupta)**: Mumbai resident, baseline average spend ₹2,400.
* **`CUST00004` (Rajesh Kumar)**: Delhi resident, baseline average spend ₹950.
* **`CUST00005` (Cold-Start Profile)**: Customer with only 1 prior transaction to test cold-start Isolation Forest evaluation.

Thread-safety is guaranteed across concurrent FastAPI worker requests via Python `threading.RLock()`.
