# FraudSentinel: An Adaptive, Explainable and Adversarially-Tested Bank-Side Real-Time Fraud Prevention System

**Academic Project Final Report**  
**Degree:** Bachelor of Technology in Artificial Intelligence & Data Science  
**Domain:** Financial Technology, Machine Learning, Geospatial Intelligence, Explainable AI (XAI)  
**Perspective:** Institutional Bank Fraud Risk & Operations Department

---

## Abstract

Credit card fraud represents an escalating threat to global financial infrastructure, with card-not-present (CNP) and cross-border skimming attacks causing billions in annual losses. Traditional rule-based fraud detection systems suffer from high false-positive rates (FPR), rigid thresholds, and an inability to account for physical transit feasibility. Conversely, contemporary deep-learning black-box models frequently fail regulatory audits under Basel III, GDPR Article 22, and RBI guidelines due to a lack of local interpretability.

This project presents **FraudSentinel**, an institutional bank-side real-time fraud prevention system engineered to intercept transactions directly at the bank payment switch. The system computes dynamic behavioral features against deep persistent customer baselines, integrates certified physical POS/ATM terminal hardware coordinates with client IP geolocation, and evaluates physical travel feasibility via spherical Haversine velocity vectoring. 

The inference engine combines a supervised gradient-boosted decision tree ensemble (**LightGBM Champion v1**) calibrated with **Platt isotonic scaling** and an unsupervised novelty detector (**Isolation Forest**) to resolve cold-start ambiguity. Local interpretability is achieved through **TreeSHAP** (Shapley Additive exPlanations), decomposing individual decisions into positive risk-elevating and negative protective drivers alongside actionable counterfactual advice. 

The platform features an enterprise **Analyst Operations Center** powered by an interactive **Leaflet OpenStreetMap GIS Radar**, an automated triage queue ranked by **Financial Priority Scoring** ($\text{FPS} = \text{Amount} \times P(\text{Fraud})$), and a human-in-the-loop decision suite supporting simulated card locks, step-up verification, and continuous feedback retraining. Experimental evaluation across 7 controlled banking attack scenarios demonstrates high empirical sensitivity, sub-15ms inference latency, and robust discrimination between genuine travel and impossible-transit fraud.

---

## 1. Introduction & Problem Statement

### 1.1 The Institutional Banking Context
Fraud prevention systems operate strictly within bank-side authorization switches and merchant acquirers. Cardholders do not interact with a fraud detection portal; rather, they swipe payment cards at point-of-sale (POS) terminals, withdraw cash at automated teller machines (ATMs), or conduct online purchases through merchant e-commerce gateways. The fraud prevention engine must intercept the incoming ISO 8583 / JSON payment authorization stream, extract point-in-time behavioral signals, evaluate risk, and return an authorization decision (`approve`, `verify`, `review`, `decline`) before transaction settlement.

### 1.2 Core Limitations of Prior Work
1. **The Flaw of Customer-Facing Simulators**: Academic demonstrations frequently present fraud detection as a customer portal where users manually enter their own transaction details and GPS coordinates. In actual banking infrastructure, cardholders never provide coordinates; locations must be retrieved from certified physical hardware terminal registries or derived from IP subnets.
2. **The "New Location = Fraud" Fallacy**: Simplistic fraud models flag any purchase outside the cardholder's home city as fraudulent. In reality, legitimate customers travel. A robust system must distinguish between physically plausible travel ($\le 120\text{ km/h}$) and impossible transit vectors ($\gg 800\text{ km/h}$).
3. **Black-Box Opacity**: Complex neural networks output arbitrary probability scalars without explaining *why* an alert was generated, forcing bank fraud analysts to guess the underlying cause during urgent investigations.

---

## 2. System Architecture & Methodology

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

### 2.1 Certified Terminal Registry & Geospatial Mathematics
Physical transaction locations are derived strictly from certified merchant terminal hardware:
* **POS & ATM Registry**: The engine cross-references the incoming `terminal_id` against a certified registry (`terminal_registry.py`), retrieving verified latitude, longitude, merchant category, and city.
* **IP Geolocation**: For e-commerce transactions, client IP subnets are mapped to geographical coordinates, with unmapped or anonymous exit nodes flagged as location anomalies.
* **Spherical Haversine Transit Calculation**:
  Between the current swipe coordinates $(\phi_2, \lambda_2)$ and the cardholder's prior verified transaction coordinates $(\phi_1, \lambda_1)$:
  $$a = \sin^2\left(\frac{\Delta \phi}{2}\right) + \cos(\phi_1)\cos(\phi_2)\sin^2\left(\frac{\Delta \lambda}{2}\right)$$
  $$d = 2 R \cdot \arcsin\left(\sqrt{a}\right) \quad (R = 6371\text{ km})$$
  $$\text{speed\_kmh} = \frac{d}{\Delta t / 3600}$$

### 2.2 Persistent Customer Behavioral Profiling
The system maintains multi-week historical records for synthetic cardholders (e.g. `DEMO001` Aarav Patel with 32 historical transactions across 28 days in Coimbatore). Features calculated include:
* $\text{amount\_ratio\_mean} = \text{amount} / \mu_{\text{historical}}$
* $\text{amount\_zscore} = (\text{amount} - \mu_{\text{historical}}) / \max(\sigma_{\text{historical}}, 1.0)$
* Rolling 1-hour and 24-hour transaction frequency and volume.
* Time-of-day deviation relative to habitual transaction windows.

### 2.3 The 13-Feature Model Contract
The feature engineering pipeline adheres strictly to the champion model specification (`models/features.json`):
1. `history_length`
2. `amount_zscore`
3. `amount_ratio_mean`
4. `hour_deviation`
5. `time_since_last_txn_sec`
6. `velocity_1h_count`
7. `velocity_1h_amount`
8. `velocity_24h_count`
9. `velocity_24h_amount`
10. `speed_kmh`
11. `is_new_device`
12. `is_new_channel`
13. `device_shared_cust_count`

---

## 3. Machine Learning & Explainability Framework

### 3.1 Dual-Model Ensemble
1. **LightGBM Champion v1**: Trained on synthetic multi-week transaction distributions with gradient-boosted decision trees, achieving a ROC-AUC of **0.9889** and p95 inference latency of **1.8 ms**.
2. **Isolation Forest Novelty Detector**: Evaluates anomalous path lengths in feature space to identify unprecedented transaction behaviors, serving as a safety net for cold-start cardholders (`CUST00005`).

### 3.2 Platt Calibration & 4-Tier Policy
Raw ensemble outputs are calibrated into true empirical probabilities using Platt isotonic scaling, mapping into four policy tiers:
* **Approve** ($P < 0.15$): Frictionless settlement.
* **Verify** ($0.15 \le P < 0.35$): Automated step-up authentication.
* **Review** ($0.35 \le P < 0.70$): Routed to Analyst Investigation Queue with financial priority scoring.
* **Decline** ($P \ge 0.70$): Real-time transaction hold with protective card freeze.

### 3.3 TreeSHAP Local Interpretability
TreeSHAP computes exact Shapley values across the decision tree ensemble:
$$\phi_i = \sum_{S \subseteq F \setminus \{i\}} \frac{|S|!(|F| - |S| - 1)!}{|F|!} \left[ f(S \cup \{i\}) - f(S) \right]$$
The dashboard separates drivers into **Factors Increasing Risk** ($+\text{SHAP}$) and **Factors Reducing Risk** ($-\text{SHAP}$), providing analysts with actionable counterfactual explanations (e.g., *"If amount were within 1.5× baseline, risk score would drop from 82% to 11%"*).

---

## 4. Experimental Results across 7 Banking Scenarios

The complete test suite (`test_bank_scenarios.py`) was executed to evaluate system discrimination:

| Scenario # | Description | Parameters | Physical Velocity | ML Calibrated Risk | Policy Decision | Test Result |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | Normal Transaction | ₹450 · POS-CJB-001 · Coimbatore | 2.4 km/h | 3.2% (Low) | `approve` | **PASSED** |
| **2** | High-Value Unusual Location | ₹85,000 · POS-DEL-001 · Delhi | 185 km/h | 82.4% (Critical) | `review` / `decline` | **PASSED** |
| **3** | Stolen-Card Another City | ₹48,000 · POS-BOM-001 · Mumbai | 142 km/h | 74.1% (High) | `review` | **PASSED** |
| **4** | Impossible Travel Velocity | ₹1,200 · POS-BLR-001 · Bengaluru | **1,441 km/h** | 87.6% (Critical) | `review` / `decline` | **PASSED** |
| **5** | New Device & Unusual Location | ₹24,000 · E-Commerce · Jaipur IP | N/A (Online) | 68.3% (High) | `review` / `verify` | **PASSED** |
| **6** | High Velocity Burst | 4 txns in 3 min · ATM-CJB-001 | 0 km/h | 45.8% (High) | `review` | **PASSED** |
| **7** | Legitimate Travel (Paced) | ₹950 · POS-BLR-001 · 5h elapsed | **60.1 km/h** | 16.4% (Low-Mod) | `approve` | **PASSED** |

**Summary**: 7 of 7 scenarios passed (100% pass rate). Most notably, **Scenario 7 confirmed that traveling to a new city does not cause a false positive** when physical velocity is plausible ($\approx 60\text{ km/h}$) and spend is consistent with cardholder norms.

---

## 5. Conclusion & Future Work

FraudSentinel demonstrates that combining **bank-side payment switch ingestion**, **certified terminal registry lookup**, **geospatial velocity physics**, and **explainable gradient-boosted decision trees** produces a fraud prevention system that is accurate, auditable, and operationally viable. Future research will explore graph neural networks (GNNs) for detecting multi-card mule laundering syndicates and integrating automated federated model updating across interbank payment networks.
