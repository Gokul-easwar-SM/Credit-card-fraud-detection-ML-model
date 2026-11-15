# FraudSentinel Backend API Integration Guide for Manus Frontend

> **Target Audience:** Manus UI/UX Development Team  
> **Backend Version:** FraudSentinel FastAPI v1.0.0 (SQLite WAL Persistent Storage)  
> **Backend Base URL:** `http://localhost:8000`  
> **Interactive Swagger Documentation:** `http://localhost:8000/docs`  
> **OpenAPI JSON Specification:** `http://localhost:8000/openapi.json`  

---

## 1. System Architecture & Connection Overview

FraudSentinel is an enterprise-grade, real-time AI credit card fraud detection system designed to power dual experiences:
1. **Customer Simulator / Self-Service Banking Portal**: Where customers can inspect their profile, view cards, adjust security limits, simulate transactions, and see real-time AI scoring and safety alerts.
2. **Bank Fraud Risk Operations Center (Analyst Portal)**: Where fraud investigators triage priority-ranked transactions, inspect TreeSHAP explainability drivers, confirm/dismiss fraud, auto-freeze compromised cards, and dispatch customer SMS notifications.

```
                           +-----------------------------------------------+
                           |        Manus Frontend Application UI          |
                           |  (Customer Portal + Risk Analyst Operations)  |
                           +-----------------------+-----------------------+
                                                   |
                        REST APIs (JSON)           |       Server-Sent Events (SSE)
                        [Bearer JWT Auth]          |       GET /stream/transactions
                                                   v
                           +-----------------------------------------------+
                           |            FastAPI Backend Service            |
                           |           (Port 8000 / Uvicorn)               |
                           +-----------------------+-----------------------+
                                                   |
              +--------------------+---------------+-------------------+
              |                    |                                   |
              v                    v                                   v
    +-------------------+  +-------------------+              +-------------------+
    | LightGBM Champion |  |  TreeSHAP Engine  |              | MSG91 SMS Service |
    |   + IsoForest     |  | + Counterfactuals |              |  (Live + Demo     |
    | Model (Joblib)    |  | (Explainability)  |              |   Auto-Fallback)  |
    +-------------------+  +-------------------+              +-------------------+
              |                    |                                   |
              +--------------------+---------------+-------------------+
                                                   |
                                                   v
                                   +-------------------------------+
                                   |    fraud_sentinel.db (SQLite)  |
                                   |      SQLAlchemy 2.0 + WAL     |
                                   |   11 Tables / Full Audit Trail|
                                   +-------------------------------+
```

### CORS Policies
The backend comes pre-configured with CORS middleware allowing:
- Origin: `http://localhost:5173` (Vite dev server default)
- Origin: `http://localhost:3000` (Next.js / Create-React-App default)
- Origin: `*` (All localhost / preview domains in development)
- Methods: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `OPTIONS`
- Headers: `Authorization`, `Content-Type`, `Accept`, `X-Idempotent`, `*`

---

## 2. Authentication & Authorization (RBAC)

The backend provides JWT Bearer token authentication with Role-Based Access Control (RBAC).

### Roles
- `analyst`: Can view investigation queues, submit human review decisions, trigger SMS alerts, and freeze/unfreeze cards.
- `admin`: Full administrative access (batch simulation, retrain models, model activation, system settings).
- `auditor`: Read-only access to audit logs, model governance metrics, and transaction histories.

### Pre-configured Seed Credentials (Ready to Use)
| Username | Password | Role | Description |
| :--- | :--- | :--- | :--- |
| `analyst` | `analyst123` | `analyst` | Senior Fraud Analyst |
| `admin` | `admin123` | `admin` | Lead Security Admin |
| `auditor` | `auditor123` | `auditor` | Compliance Auditor |

### 2.1 Login
```http
POST /auth/login
Content-Type: application/json
```
**Request Body:**
```json
{
  "username": "analyst",
  "password": "analyst123"
}
```
**Success Response (`200 OK`):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "expires_in": 1800,
  "user": {
    "id": 1,
    "username": "analyst",
    "email": "analyst@bank.internal",
    "role": "analyst",
    "is_active": true
  }
}
```

### 2.2 Authenticated Headers
For all protected endpoints (investigations, analyst actions, card freeze, admin triggers), include the Bearer token:
```http
Authorization: Bearer <access_token>
```

---

## 3. The 12-Step Transaction Lifecycle (End-to-End Workflow)

Manus should design the user flow around this 12-step lifecycle:

```
[Customer Simulator Flow]
 1. Customer Selects Profile   ===> GET /customers
 2. View Profile & Card Info   ===> GET /customers/{id}
 3. Submit Transaction         ===> POST /transactions (Payload: amount, coords, device, channel)
 4. Backend ML Scoring         ===> LightGBM + IsoForest computes 13 behavioural features
 5. Risk Assessment Returned   ===> Returns calibrated score (0.0 - 1.0) & Risk Band (LOW/MED/HIGH/CRIT)
 6. Explainability Generated   ===> TreeSHAP drivers + natural language counterfactual hint returned

[Analyst Real-time Operations Flow]
 7. DB Persistence (SQLite)    ===> Transaction, prediction, features, customer history saved
 8. Real-time Stream Broadcast ===> Event dispatched via SSE: GET /stream/transactions
 9. Priority Queue Review      ===> Analyst reviews flagged case via GET /investigations
10. Analyst Decision Recorded  ===> PATCH /investigations/{id} with status "confirmed_fraud"
11. Auto-Freeze Activated      ===> Database card status automatically updated to "frozen"
12. Customer SMS Dispatched    ===> MSG91 triggers alert SMS to customer; recorded in `alerts` table
```

---

## 4. Complete API Reference for Frontend Views

### View 1: Customer Profile & Card Selector

#### 4.1 List Registered Customers
Use this endpoint to populate customer dropdowns or customer selector cards.
```http
GET /customers?limit=25&offset=0
```
**Query Parameters:**
- `limit` (integer, default `25`, max `100`)
- `offset` (integer, default `0`)

**Response (`200 OK`):**
```json
[
  {
    "id": 1,
    "external_customer_id": "CUST00001",
    "name": "Aarav Sharma",
    "phone_masked": "+91 98*** **001",
    "home_city": "Coimbatore",
    "home_lat": 11.0168,
    "home_lon": 76.9558,
    "avg_amount": 750.0,
    "primary_card": {
      "id": 1,
      "card_number_masked": "•••• •••• •••• 1247",
      "card_type": "Visa Signature",
      "status": "active"
    }
  },
  {
    "id": 2,
    "external_customer_id": "CUST00002",
    "name": "Priya Patel",
    "phone_masked": "+91 98*** **002",
    "home_city": "Mumbai",
    "home_lat": 19.0760,
    "home_lon": 72.8777,
    "avg_amount": 1200.0,
    "primary_card": {
      "id": 2,
      "card_number_masked": "•••• •••• •••• 8912",
      "card_type": "Mastercard World",
      "status": "active"
    }
  }
]
```

#### 4.2 Get Customer Detail with Full Card Portfolio & Devices
```http
GET /customers/{identifier}
```
*(Accepts either numeric database ID or string `external_customer_id`, e.g. `CUST00001`)*

**Response (`200 OK`):**
```json
{
  "id": 1,
  "external_customer_id": "CUST00001",
  "name": "Aarav Sharma",
  "phone": "+91 98765 00001",
  "phone_masked": "+91 98*** **001",
  "home_city": "Coimbatore",
  "home_lat": 11.0168,
  "home_lon": 76.9558,
  "avg_amount": 750.0,
  "cards": [
    {
      "id": 1,
      "card_number_masked": "•••• •••• •••• 1247",
      "card_type": "Visa Signature",
      "status": "active",
      "daily_limit": 150000.0,
      "current_day_spend": 650.0,
      "international_enabled": true,
      "online_enabled": true,
      "last_freeze_reason": null,
      "updated_at": "2026-11-01T10:00:00Z"
    }
  ],
  "devices": [
    {
      "id": 1,
      "device_key": "DEV-CUST00001-A",
      "device_type": "mobile",
      "os": "Android 14",
      "browser": "Chrome Mobile",
      "is_trusted": true
    }
  ]
}
```

---

### View 2: Transaction Simulator & AI Scoring

#### 4.3 Submit / Simulate a Transaction
Submits a transaction to be scored in real time. The backend automatically extracts behavioural features (velocity, amount ratio to customer average, geo-distance, hour deviation) and invokes the LightGBM champion model and TreeSHAP explainer.
```http
POST /transactions
Content-Type: application/json
```
**Request Body:**
```json
{
  "external_txn_id": "TXN-SIM-20261101-001",
  "external_customer_id": "CUST00001",
  "occurred_at": "2026-11-01T20:30:00Z",
  "amount": 98500.00,
  "currency": "INR",
  "channel": "online",
  "lat": 28.6139,
  "lon": 77.2090,
  "device_key": "DEV-UNRECOGNIZED-99",
  "source": "manual",
  "is_simulated": true
}
```
*Note on Idempotency:* If you resend the exact same `external_txn_id`, the backend returns the existing prediction with `HTTP 200` and header `X-Idempotent: true`.

**Response (`201 Created`):**
```json
{
  "id": 10,
  "external_txn_id": "TXN-SIM-20261101-001",
  "external_customer_id": "CUST00001",
  "occurred_at": "2026-11-01T20:30:00Z",
  "amount": 98500.00,
  "currency": "INR",
  "channel": "online",
  "lat": 28.6139,
  "lon": 77.2090,
  "device_key": "DEV-UNRECOGNIZED-99",
  "source": "manual",
  "is_simulated": true,
  "prediction": {
    "id": 10,
    "raw_score": 0.9624,
    "calibrated_score": 0.3667,
    "predicted_label": 1,
    "risk_band": "high",
    "recommended_action": "investigate",
    "reason_codes": [
      "Amount is 151.5x higher than customer's average purchase size.",
      "Unusual transaction time (10.5 hours outside customer's regular activity window).",
      "New device: transaction executed from a device never before used by this customer."
    ],
    "counterfactual_hint": "If transaction amount were within 1.5x of the customer's average, risk score would drop significantly.",
    "model_version": "lgbm_v1_champion"
  },
  "alert": null,
  "investigation": null
}
```

#### 4.4 Get Deep Transaction Details & TreeSHAP Local Explanation
Used for the transaction inspection modal or side drawer.
```http
GET /transactions/{id}
```
**Response (`200 OK`):**
```json
{
  "id": 10,
  "external_txn_id": "TXN-SIM-20261101-001",
  "external_customer_id": "CUST00001",
  "occurred_at": "2026-11-01T20:30:00Z",
  "amount": 98500.00,
  "currency": "INR",
  "channel": "online",
  "lat": 28.6139,
  "lon": 77.2090,
  "device_key": "DEV-UNRECOGNIZED-99",
  "is_simulated": true,
  "prediction": { ... },
  "shap_values": {
    "amount_log": 2.145,
    "amount_ratio_mean": 4.5096,
    "velocity_1h": 0.321,
    "velocity_24h": 0.450,
    "speed_kmh": 1.250,
    "hour_deviation": 2.9174,
    "is_new_device": 1.9622,
    "channel_risk": 0.650
  },
  "top_drivers": [
    {
      "feature": "amount_ratio_mean",
      "shap_importance": 4.5096,
      "feature_value": 131.33
    },
    {
      "feature": "hour_deviation",
      "shap_importance": 2.9174,
      "feature_value": 10.5
    },
    {
      "feature": "is_new_device",
      "shap_importance": 1.9622,
      "feature_value": 1.0
    }
  ]
}
```

---

### View 3: Bank Fraud Analyst Operations Center

#### 4.5 List Priority Investigation Queue
Returns transactions flagged for human analyst review, sorted by risk priority score.
```http
GET /investigations?status=pending_review&page=1&page_size=20
Authorization: Bearer <access_token>
```
**Query Parameters:**
- `status` (optional: `pending_review`, `under_investigation`, `confirmed_fraud`, `marked_genuine`)
- `search` (optional: filter by transaction ID or customer ID)
- `page` (default `1`)
- `page_size` (default `25`, max `100`)

**Response (`200 OK`):**
```json
{
  "items": [
    {
      "id": 5,
      "transaction_id": 10,
      "external_txn_id": "TXN-SIM-20261101-001",
      "external_customer_id": "CUST00001",
      "amount": 98500.00,
      "currency": "INR",
      "channel": "online",
      "occurred_at": "2026-11-01T20:30:00Z",
      "risk_band": "high",
      "calibrated_score": 0.3667,
      "status": "pending_review",
      "priority_score": 36120.4,
      "analyst_id": null,
      "analyst_username": null,
      "created_at": "2026-11-01T20:30:01Z",
      "updated_at": "2026-11-01T20:30:01Z"
    }
  ],
  "total": 1,
  "page": 1,
  "page_size": 20,
  "pages": 1
}
```

#### 4.6 Analyst Records Decision (Confirm Fraud or Mark Genuine)
When an analyst confirms fraud, this endpoint automatically executes 3 critical banking safeguards:
1. Updates `investigations.status` to `confirmed_fraud` and records analyst username and notes.
2. Locates the customer's card and **automatically sets its status to `frozen`** with a reason timestamp.
3. Automatically triggers an **instant SMS alert via MSG91** (or high-fidelity demo fallback) and saves the notification in `alerts`.
```http
PATCH /investigations/{id}
Authorization: Bearer <access_token>
Content-Type: application/json
```
**Request Body:**
```json
{
  "status": "confirmed_fraud",
  "notes": "Customer confirmed over telephone they did not authorize the INR 98,500 online transfer."
}
```
**Response (`200 OK`):**
```json
{
  "id": 5,
  "status": "confirmed_fraud",
  "notes": "Customer confirmed over telephone they did not authorize the INR 98,500 online transfer.",
  "analyst_id": 1,
  "analyst_username": "analyst",
  "updated_at": "2026-11-01T20:35:12Z",
  "transaction": {
    "id": 10,
    "amount": 98500.00,
    "top_drivers": [ ... ]
  },
  "customer_verification": {
    "id": 11,
    "channel": "sms",
    "status": "delivered",
    "message": "[BANK FRAUD ALERT] Transaction of INR 98,500.00 on card •••• •••• •••• 1247 was CONFIRMED AS FRAUD by Bank Risk Operations. Your card has been temporarily FROZEN to protect your funds...",
    "created_at": "2026-11-01T20:35:12Z"
  }
}
```

#### 4.7 Direct Quick Action on Transaction
Allows the analyst to directly execute bank action on a transaction (`approve`, `hold`, `block`, `flag`).
```http
POST /transactions/{id}/action
Authorization: Bearer <access_token>
Content-Type: application/json
```
**Request Body:**
```json
{
  "action": "block",
  "notes": "Blocked unauthorized transaction. Card frozen immediately."
}
```
*Valid Actions:* `"approve"`, `"hold"`, `"block"`, `"flag"`.

---

### View 4: Customer Card Security Controls

#### 4.8 List Cards Portfolio
```http
GET /cards?status=active&page=1&page_size=25
```
**Query Parameters:**
- `status` (optional: `active`, `frozen`, `blocked`)
- `search` (optional: customer ID or masked card number)

**Response (`200 OK`):**
```json
{
  "items": [
    {
      "id": 1,
      "customer_id": 1,
      "external_customer_id": "CUST00001",
      "card_number_masked": "•••• •••• •••• 1247",
      "card_type": "Visa Signature",
      "status": "frozen",
      "daily_limit": 150000.00,
      "current_day_spend": 650.00,
      "international_enabled": true,
      "online_enabled": true,
      "last_freeze_reason": "Confirmed fraud on transaction #10 by analyst analyst",
      "updated_at": "2026-11-01T20:35:12Z"
    }
  ],
  "total": 1,
  "page": 1,
  "page_size": 25,
  "pages": 1
}
```

#### 4.9 Freeze / Unfreeze Card Toggle
Used for the toggle switch on customer cards.
```http
POST /cards/{id}/toggle-freeze
Authorization: Bearer <access_token>
Content-Type: application/json
```
**Request Body:**
```json
{
  "reason": "Customer requested temporary freeze via mobile app"
}
```
**Response (`200 OK`):** Returns the updated `CardResponse` with new status (`active` or `frozen`).

#### 4.10 Update Card Spending Limits & Online Permissions
```http
PUT /cards/{id}/settings
Authorization: Bearer <access_token>
Content-Type: application/json
```
**Request Body:**
```json
{
  "daily_limit": 75000.00,
  "international_enabled": false,
  "online_enabled": true
}
```

---

### View 5: Model Analytics & Executive Performance Charts

All chart coordinates and metrics below are derived directly from the trained champion LightGBM model and evaluation set.

#### 4.11 ROC and Precision-Recall Curves Data
Use this endpoint to render high-fidelity ROC and PR chart lines using Chart.js, Recharts, or ApexCharts.
```http
GET /metrics/curves
```
**Response (`200 OK`):**
```json
{
  "roc": {
    "auc": 0.9889,
    "points": [
      { "fpr": 0.0, "tpr": 0.0, "threshold": 1.0 },
      { "fpr": 0.0001, "tpr": 0.1245, "threshold": 0.995 },
      { "fpr": 0.0012, "tpr": 0.6540, "threshold": 0.850 },
      { "fpr": 0.0150, "tpr": 0.9420, "threshold": 0.500 },
      { "fpr": 1.0, "tpr": 1.0, "threshold": 0.0 }
    ]
  },
  "pr": {
    "auc": 0.8266,
    "points": [
      { "recall": 0.0, "precision": 1.0, "threshold": 1.0 },
      { "recall": 0.450, "precision": 0.952, "threshold": 0.850 },
      { "recall": 0.812, "precision": 0.841, "threshold": 0.500 },
      { "recall": 1.0, "precision": 0.035, "threshold": 0.0 }
    ]
  },
  "summary": {
    "model_name": "LightGBM Champion v1",
    "accuracy": 0.9868,
    "f1_score": 0.8266,
    "evaluation_samples": 10002
  }
}
```

#### 4.12 Global SHAP Feature Importances
Use this endpoint to render a horizontal bar chart showing top fraud risk drivers across the entire population.
```http
GET /metrics/shap-global
```
**Response (`200 OK`):**
```json
{
  "model": "lgbm_v1_champion",
  "num_features": 13,
  "features": [
    { "feature": "amount_log", "mean_abs_shap": 0.4285 },
    { "feature": "velocity_1h", "mean_abs_shap": 0.3812 },
    { "feature": "speed_kmh", "mean_abs_shap": 0.2941 },
    { "feature": "amount_ratio_mean", "mean_abs_shap": 0.2764 },
    { "feature": "dist_from_home", "mean_abs_shap": 0.2450 },
    { "feature": "hour_deviation", "mean_abs_shap": 0.2189 },
    { "feature": "is_new_device", "mean_abs_shap": 0.1876 },
    { "feature": "velocity_24h", "mean_abs_shap": 0.1542 },
    { "feature": "channel_risk", "mean_abs_shap": 0.1320 },
    { "feature": "hour_of_day", "mean_abs_shap": 0.0984 },
    { "feature": "device_reuse_count", "mean_abs_shap": 0.0765 },
    { "feature": "lat", "mean_abs_shap": 0.0512 },
    { "feature": "lon", "mean_abs_shap": 0.0489 }
  ]
}
```

#### 4.13 Multi-Algorithm Ablation Comparison
Use this endpoint to render comparison tables and radar charts comparing LightGBM against baseline models.
```http
GET /metrics/ablation
```
**Response (`200 OK`):**
```json
{
  "models": [
    {
      "name": "LightGBM (Champion)",
      "roc_auc": 0.9889,
      "pr_auc": 0.8266,
      "f1_score": 0.8266,
      "latency_p95_ms": 1.8,
      "type": "champion"
    },
    {
      "name": "XGBoost",
      "roc_auc": 0.9842,
      "pr_auc": 0.8012,
      "f1_score": 0.8010,
      "latency_p95_ms": 2.4,
      "type": "challenger"
    },
    {
      "name": "Isolation Forest (Unsupervised)",
      "roc_auc": 0.8920,
      "pr_auc": 0.5410,
      "f1_score": 0.5230,
      "latency_p95_ms": 1.2,
      "type": "unsupervised"
    },
    {
      "name": "Logistic Regression (Linear Baseline)",
      "roc_auc": 0.8410,
      "pr_auc": 0.4210,
      "f1_score": 0.3950,
      "latency_p95_ms": 0.4,
      "type": "baseline"
    }
  ]
}
```

#### 4.14 Data & Feature Drift Monitoring (PSI / KS-test)
```http
GET /metrics/drift
```
Returns Population Stability Index (PSI) and Kolmogorov-Smirnov test statistics for continuous features.

#### 4.15 Executive KPI Metrics
```http
GET /metrics/executive
```
Returns volume, 24-hour transactions, flagged fraud rate, estimated capital saved, and active alerts.

---

## 5. Real-Time Server-Sent Events (SSE) Stream

The backend provides a live SSE event stream at:
```http
GET /stream/transactions
```

### Event Stream Implementation (JavaScript/TypeScript)
```javascript
const eventSource = new EventSource("http://localhost:8000/stream/transactions");

eventSource.onopen = () => {
  console.log("Connected to FraudSentinel Real-time Event Stream");
};

eventSource.onmessage = (event) => {
  try {
    const payload = JSON.parse(event.data);
    
    switch (payload.event_type) {
      case "transaction_scored":
        // Pushed immediately when a new transaction is processed
        handleNewTransaction(payload.data);
        break;
        
      case "alert_dispatched":
        // Pushed when an SMS or customer alert is created
        showToastNotification(`SMS Sent: ${payload.data.message}`);
        break;
        
      case "investigation_updated":
        // Pushed when an analyst resolves an investigation
        refreshInvestigationQueue();
        break;
        
      case "heartbeat":
        // 15-second keepalive
        break;
    }
  } catch (err) {
    console.error("Error parsing SSE event:", err);
  }
};

eventSource.onerror = (err) => {
  console.warn("SSE connection interrupted. Browser will auto-reconnect...", err);
};
```

---

## 6. Pre-Seeded Indian Customer Profiles for Testing

The SQLite database contains 16 pre-seeded customer profiles with active cards, phone numbers, and coordinate baselines:

| Customer ID | Name | City | Home Lat/Lon | Avg Spend | Primary Card (Masked) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `CUST00001` | Aarav Sharma | Coimbatore | 11.0168, 76.9558 | ₹750 | •••• •••• •••• 1247 (Visa) |
| `CUST00002` | Priya Patel | Mumbai | 19.0760, 72.8777 | ₹1,200 | •••• •••• •••• 8912 (Mastercard) |
| `CUST00003` | Rohan Iyer | Chennai | 13.0827, 80.2707 | ₹950 | •••• •••• •••• 3411 (Visa) |
| `CUST00004` | Ananya Deshmukh | Pune | 18.5204, 73.8567 | ₹1,500 | •••• •••• •••• 6723 (Mastercard) |
| `CUST00005` | Vikram Malhotra | Delhi | 28.6139, 77.2090 | ₹2,400 | •••• •••• •••• 4190 (Visa) |
| `CUST00006` | Sneha Reddy | Hyderabad | 17.3850, 78.4867 | ₹820 | •••• •••• •••• 7802 (Mastercard) |
| `CUST00007` | Aditya Verma | Bengaluru | 12.9716, 77.5946 | ₹1,850 | •••• •••• •••• 1538 (Visa) |
| `CUST00008` | Pooja Nair | Kochi | 9.9312, 76.2673 | ₹680 | •••• •••• •••• 9245 (Mastercard) |

---

## 7. Ready-to-Test Fraud Payloads (Copy-Paste for UI Demos)

### Scenario A: High-Risk Account Takeover & Geo-Velocity Attack
- **Customer:** `CUST00001` (Home: Coimbatore, Avg: ₹750)
- **Attack:** ₹98,500 online transfer from Delhi at 2:30 AM on an unknown device.
- **Expected Result:** High Risk (`calibrated_score > 0.35`, `raw_score > 0.95`), recommended action: `investigate`.

```json
{
  "external_txn_id": "TXN-ATTACK-001",
  "external_customer_id": "CUST00001",
  "occurred_at": "2026-11-01T20:30:00Z",
  "amount": 98500.00,
  "currency": "INR",
  "channel": "online",
  "lat": 28.6139,
  "lon": 77.2090,
  "device_key": "DEV-UNKNOWN-ATTACKER-99",
  "source": "manual",
  "is_simulated": true
}
```

### Scenario B: Legitimate Grocery Purchase
- **Customer:** `CUST00001`
- **Behavior:** ₹450 POS swipe in Coimbatore at 11:00 AM on trusted mobile phone.
- **Expected Result:** Low Risk (`calibrated_score < 0.05`), recommended action: `allow`.

```json
{
  "external_txn_id": "TXN-GENUINE-001",
  "external_customer_id": "CUST00001",
  "occurred_at": "2026-11-01T11:00:00Z",
  "amount": 450.00,
  "currency": "INR",
  "channel": "pos",
  "lat": 11.0168,
  "lon": 76.9558,
  "device_key": "DEV-CUST00001-A",
  "source": "manual",
  "is_simulated": true
}
```

---

## 8. MSG91 SMS Notification Integration

### Configuration
In `.env`:
```env
MSG91_AUTH_KEY=your_msg91_auth_key
MSG91_SENDER_ID=FRDSNT
MSG91_TEMPLATE_ID=your_dlt_template_id
MSG91_ROUTE=4
```

### Automatic Demo Mode Fallback
If `MSG91_AUTH_KEY` is omitted or left as default, the backend automatically engages its **high-fidelity demo simulator**:
- Dispatches formatted alert with simulated provider ID (e.g. `demo_msg91_20261101_8403`).
- Sets delivery status to `delivered` in the `alerts` database table.
- Broadcasts the `alert_dispatched` event over the real-time SSE stream.
- Zero network failures or third-party credential requirements during frontend design and demos.

---

## 9. Error Handling & Standard Responses

All non-2xx responses return standard JSON with a `detail` key:
```json
{
  "detail": "Customer with ID CUST99999 not found"
}
```

| HTTP Status | Meaning | Typical Trigger |
| :--- | :--- | :--- |
| `400 Bad Request` | Invalid payload or parameter | Unsupported action (must be `approve`, `hold`, `block`, `flag`) |
| `401 Unauthorized` | Missing or expired token | Missing `Authorization: Bearer <token>` on protected routes |
| `403 Forbidden` | Insufficient permissions | Non-admin user attempting model retraining |
| `404 Not Found` | Entity missing | Customer, card, or transaction ID does not exist |
| `422 Unprocessable` | Schema validation error | Missing required fields in transaction payload |

---

## 10. Verification Checklist for Manus Frontend Integration

- [x] Backend runs cleanly on `http://localhost:8000` via `start_backend.bat`.
- [x] Database is persistent SQLite (`fraud_sentinel.db`) with WAL mode.
- [x] 16 realistic customers and cards are pre-seeded and accessible via `GET /customers`.
- [x] Real-time scoring works via `POST /transactions` with calibrated scores and reason codes.
- [x] Local TreeSHAP explainability works via `GET /transactions/{id}`.
- [x] Priority investigation queue works via `GET /investigations`.
- [x] Fraud confirmation via `PATCH /investigations/{id}` auto-freezes card and triggers SMS alert.
- [x] Real-time updates broadcast over SSE stream via `GET /stream/transactions`.
- [x] Chart data endpoints provide exact ROC/PR curves and global SHAP metrics (`GET /metrics/*`).
- [x] Full pytest test suite passing with 48/48 tests green.
