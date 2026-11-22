# FraudSentinel: Enterprise Bank-Side Real-Time Fraud Prevention Architecture

**System Architecture & Engineering Specification Document**  
**Classification:** Institutional Bank-Side Fraud Prevention & Risk Operations Center  
**Target Domain:** Core Banking Payment Switches, Real-Time Transaction Ingestion, Geospatial Intelligence & Explainable AI

---

## 1. Executive System Overview

**FraudSentinel** is an institutional **bank-side fraud prevention system** designed to operate directly inside core banking switches and payment rails (ATM networks, merchant POS acquirers, and e-commerce payment gateways). 

### Core Architectural Principle
FraudSentinel is **not** a customer-facing payment portal where cardholders submit transactions. Ordinary cardholders swipe their debit and credit cards at merchant POS terminals, withdraw cash at bank ATMs, or purchase goods online. 

As transactions traverse the bank's authorization switch (via ISO 8583 / JSON payment authorization messages), FraudSentinel intercepts the transaction stream in real time. In under 15 milliseconds, the system:
1. Resolves certified physical hardware terminal coordinates or client IP subnets.
2. Retrieves deep persistent customer historical baselines.
3. Calculates geospatial transit distance, elapsed time, and physical travel velocity.
4. Extracts a 13-dimensional behavioral feature vector compatible with the champion ML model.
5. Computes ensemble fraud risk via **LightGBM Champion v1 + Isolation Forest**.
6. Decomposes feature attributions via **TreeSHAP** into risk-increasing vs protective factors.
7. Dispatches the scored transaction via real-time Server-Sent Events (SSE) to the **Analyst Operations Center** for live GIS radar monitoring, triage, and rapid case resolution.

```
       [ Physical POS Terminals / ATM Networks / Online Payment Gateways ]
                                      │
                                      ▼ (ISO 8583 / JSON Switch Event)
                        [ Bank Payment Switch Engine ]
                                      │
                                      ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                  FraudSentinel Real-Time Intelligence Pipeline               │
│                                                                              │
│  1. Terminal & IP Registry Lookup (Certified POS/ATM Hardware & IP Subnet)   │
│  2. Customer Baseline Retrieval (32+ Deep Historical Norms & Spending Bands) │
│  3. Geospatial Feature Engineering (Haversine Distance & Travel Velocity)    │
│  4. 13-Feature Behavioral Extraction (Exact Match to Trained Model Contract) │
│  5. Dual ML Scoring (LightGBM Supervised Champion + Isolation Forest Novelty)│
│  6. Platt Calibration & 4-Tier Policy (Approve · Verify · Review · Decline)  │
│  7. TreeSHAP Feature Attribution (Risk Elevating vs Protective Drivers)      │
│  8. SSE Live Event Publication (Standardized {event_type, data} Envelope)    │
└──────────────────────────────────────┬───────────────────────────────────────┘
                                       │
                                       ▼ (Real-Time SSE Stream)
               [ Bank Analyst Operations Center & GIS Radar ]
     (OpenStreetMap Radar · Investigation Queue · Dossiers · Simulated Card Lock)
```

---

## 2. Ingestion & Geospatial Intelligence

### A. Certified Hardware Terminal Registry
Cardholders never enter geographic coordinates. Physical transaction locations are derived strictly from certified merchant terminal hardware:
* **POS Terminals**: Registered merchant hardware terminals (e.g., `POS-CJB-001` at Starbucks Coffee, Coimbatore; `POS-DEL-001` at Zaveri Luxury Jewelers, Delhi). The system looks up certified latitude, longitude, city, and merchant category (`terminal_registry.py`).
* **ATM Cash Dispensers**: Physical cash machines (e.g., `ATM-CJB-001` SBI ATM, Coimbatore; `ATM-BOM-001` ICICI ATM, Mumbai) mapped to certified geographic coordinates.
* **Online Payment Gateways**: E-commerce transactions arriving via gateways (Razorpay, BillDesk, CCAvenue, Shopify) pass the cardholder's client IP. The engine maps the IP subnet to city and coordinates. Unmapped IPs or Tor exit nodes explicitly flag `is_unusual_location = True` with `location_source = "ip_geolocation"`.

### B. Geospatial Transit & Velocity Vector Engine
Between the cardholder's current swipe $(\phi_2, \lambda_2)$ and their immediate prior verified transaction $(\phi_1, \lambda_1)$, the engine computes spherical great-circle distance using the **Haversine Formula**:

$$a = \sin^2\left(\frac{\Delta \phi}{2}\right) + \cos(\phi_1)\cos(\phi_2)\sin^2\left(\frac{\Delta \lambda}{2}\right)$$
$$d = 2 R \cdot \arcsin\left(\sqrt{a}\right) \quad (\text{where } R = 6371\text{ km})$$
$$\text{speed\_kmh} = \frac{d}{\Delta t / 3600}$$

* **Impossible Travel Violation**: If $\text{speed\_kmh} > 800\text{ km/h}$, the transaction is flagged with an impossible travel velocity violation (physical card cloning signature).
* **Legitimate Paced Travel**: If a cardholder travels from Coimbatore to Bengaluru (360 km) over 5 hours ($\approx 60\text{ km/h}$), the system recognizes physical plausibility, scoring the transaction as low/moderate risk and auto-approving it.

---

## 3. Persistent Customer Behavioral Baselines

To eliminate artificial randomness, FraudSentinel establishes persistent synthetic banking customer records:

| Customer ID | Cardholder Name | Home Corridor | Historical Txns | Baseline Avg Spend | Common Channels | Profile Maturity |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `DEMO001` | Aarav Patel | Coimbatore (TN) | 32 txns (28 days) | ₹1,250 ($\sigma \approx 420$) | POS, ATM | Mature Baseline |
| `CUST00001` | Priya Sharma | Chennai (TN) | 24 txns (21 days) | ₹1,850 ($\sigma \approx 650$) | POS, Online | Mature Baseline |
| `CUST00002` | Vikram Malhotra | Bengaluru (KA) | 18 txns (14 days) | ₹3,200 ($\sigma \approx 1,100$) | POS, Online, ATM | Developing Baseline |
| `CUST00003` | Neha Gupta | Mumbai (MH) | 29 txns (25 days) | ₹2,400 ($\sigma \approx 890$) | POS, Online | Mature Baseline |
| `CUST00004` | Rajesh Kumar | Delhi (DL) | 15 txns (12 days) | ₹950 ($\sigma \approx 310$) | ATM, POS | Developing Baseline |
| `CUST00005` | Cold-Start Profile | Unknown | 1 txn (0 days) | ₹500 ($\sigma = 0$) | POS | Cold-Start Profile |

### Point-in-Time Feature Calculations
1. **Amount Deviation ($Z$-score & Ratio)**: Evaluated strictly against the customer's legitimate multi-week baseline.
2. **Transaction Velocity (1-Hour & 24-Hour)**: Aggregates rolling count and total amount within prior 1h and 24h windows.
3. **Time-of-Day Deviation**: Absolute hour distance from the cardholder's routine operational hours (e.g. 08:00–22:00 IST).
4. **Hardware & Channel Innovation**: Boolean flags (`is_new_device`, `is_new_channel`) checking if the hardware signature or payment channel has ever been registered to this cardholder.

---

## 4. Machine Learning & Explainable AI Architecture

FraudSentinel enforces strict backward compatibility with its trained 13-feature contract (`models/features.json`):

```json
[
  "history_length",
  "amount_zscore",
  "amount_ratio_mean",
  "hour_deviation",
  "time_since_last_txn_sec",
  "velocity_1h_count",
  "velocity_1h_amount",
  "velocity_24h_count",
  "velocity_24h_amount",
  "speed_kmh",
  "is_new_device",
  "is_new_channel",
  "device_shared_cust_count"
]
```

### Ensemble Components
1. **Supervised Champion (LightGBM)**: 100 gradient-boosted decision trees trained with depth constraints to optimize ROC-AUC (0.9889) and PR-AUC.
2. **Unsupervised Novelty Detector (Isolation Forest)**: Isolates out-of-distribution feature spaces to protect cold-start cardholders (`CUST00005`) who lack extensive historical data.
3. **Platt Sigmoid Calibration**: Maps raw model outputs into empirical posterior probabilities:
   $$P(\text{Fraud} \mid x) = \frac{1}{1 + \exp(A \cdot f(x) + B)}$$
4. **4-Tier Policy Decisioning**:
   - **`approve`** ($P < 0.15$): Instant automated switch settlement.
   - **`verify`** ($0.15 \le P < 0.35$): Automated step-up authentication challenge.
   - **`review`** ($0.35 \le P < 0.70$): Routed to Analyst Investigation Queue with financial priority scoring.
   - **`decline`** ($P \ge 0.70$): Real-time transaction hold with protective card freeze.
5. **Bidirectional TreeSHAP Feature Attribution**:
   Decomposes each individual prediction into risk-elevating factors ($+\text{SHAP}$) versus protective baseline factors ($-\text{SHAP}$), accompanied by plain-English counterfactual advice.

---

## 5. Analyst Operations Center & OpenStreetMap GIS Radar

The bank analyst workspace is powered by an interactive **Leaflet OpenStreetMap GIS engine**:
* **High-Resolution Street-Level Tiles**: Full road networks, intersections, airports, and landmarks across India with zero API keys or external watermarks.
* **Pin 1 (Prior Swipe)**: Blue/navy badge marking the verified prior transaction.
* **Pin 2 (Current Swipe)**: Pulsing animated badge colored by risk tier (Green = Low, Amber = Review, Red = Fraud).
* **Transit Vector Polyline**: Draws the geographic line connecting consecutive swipes with an inline badge displaying distance in km and travel speed in km/h.
* **Analyst Decision & Safeguards**:
  - `Mark Genuine (Approve)`: Records analyst clearance and queues transaction for feedback training.
  - `Mark Suspicious (Hold)`: Holds transaction under active fraud inquiry.
  - `Request Step-Up Verification`: Dispatches simulated 2FA challenge to the cardholder device.
  - `Escalate Case`: Routes case to Level 2 Fraud Risk Committee.
  - `Temporarily Lock Card (Simulated)` / `Unlock Card`: Toggles card state in the simulation ledger.
  - `Confirm Fraud (Auto-Freeze Card & SMS)`: Executes simulated card freeze and dispatches MSG91 alert.

---

## 6. Controlled Demonstration Scenarios

The platform includes 7 pre-packaged bank payment scenarios verifying every pipeline branch:

1. **Normal Transaction (Usual Location)**: Aarav Patel spends ₹450 at coffee shop in Coimbatore (`POS-CJB-001`). Recognized terminal, normal amount. $\rightarrow$ **Approved / Low Risk (<15%)**.
2. **High-Value at Unusual Location**: Aarav Patel attempts ₹85,000 at Luxury Jewelers in Delhi (`POS-DEL-001`). 68× baseline spend, cross-country terminal. $\rightarrow$ **Flagged for Review / High Risk (>75%)**.
3. **Stolen-Card in Another City**: Card presented for ₹48,000 at electronics store in Mumbai (`POS-BOM-001`) with unmapped hardware. $\rightarrow$ **Flagged for Review / High Risk (>70%)**.
4. **Impossible Travel Velocity**: Card swiped in Bengaluru (`POS-BLR-001`) 15 minutes after Coimbatore swipe (360 km = 1,441 km/h). $\rightarrow$ **Critical Anomaly / Impossible Physical Speed Flag**.
5. **New Device & Unusual Location**: Online transaction of ₹24,000 originating from new hardware key on an unmapped IP subnet in Jaipur. $\rightarrow$ **High Risk (>65%) / Step-Up Challenge**.
6. **High Transaction Velocity**: 4 rapid withdrawals within 3 minutes at Coimbatore ATM (`ATM-CJB-001`). Sudden velocity spike. $\rightarrow$ **Elevated Risk / Velocity Burst Flag**.
7. **Normal Spend at New Location (Legitimate Travel)**: Aarav Patel buys lunch for ₹950 in Bengaluru (`POS-BLR-001`) 5 hours after Coimbatore transaction (60 km/h). Plausible travel window, normal amount. $\rightarrow$ **Approved / Low-Moderate Risk (<25%)**.
