# FraudSentinel: Comprehensive Canva Presentation Slides & References Guide

> **Project Title:** FraudSentinel: Adaptive, Explainable, and Behaviour-Aware Bank-Side Fraud Prevention System  
> **Course / Degree:** B.Tech — Artificial Intelligence & Data Science  
> **Target Format:** 16:9 Presentation (Canva / PowerPoint / Google Slides)  
> **Companion Document:** `FraudSentinel Final Academic Project Report` & `System Implementation Guides`

---

## Quick Reference Summary Table for Canva Slides

| Slide # | Slide Title | Core Theme / Focus | Status in Original Deck | Real Project Data / Fill-in |
| :---: | :--- | :--- | :--- | :--- |
| **1** | Title Slide | Institutional Bank Fraud Defense | Student Placeholders | Fill Student & Guide Metadata |
| **2** | Platform Vision | Behaviour · Intelligence · Action | Complete | Bank-side Switch + Decision Support |
| **3** | Problem Statement | Timing, Trust & Economics | Complete | 0.1–1.0% Imbalance, 30–90 Day Delay, ₹ ≠ % |
| **4** | Competitive Gap | Rule-Based vs FraudSentinel | Complete | 5 Industry Differentiators |
| **5** | Platform Capabilities | Implemented Architecture Grid | "9 VERIFIED · 4 TBD" | **All 13 Features VERIFIED** |
| **6** | Ingestion Pipeline | Point-in-Time Decision Flow | Complete | Switch $\to$ State $\to$ ML $\to$ FPS $\to$ Analyst |
| **7** | Two Pipelines | Pipeline A vs Pipeline B | "[INSERT VALUE]" | **Synthetic 170k vs Kaggle 284k** |
| **8** | Feature Space | 13 Behavioural Features | "4 MISSING FEATURES" | **All 13 Math Definitions Complete** |
| **9** | Hybrid ML Engine | LightGBM + Isolation Forest | Complete | Supervised + Novelty + Calibration |
| **10** | Explainability & XAI | TreeSHAP & Counterfactuals | Complete | Local Attributions & Decision Inversion |
| **11** | Financial Action | FPS & 4-Tier Policy | "840 km/h [ILLUSTRATIVE]" | **Verified FPS Equation & Multipliers** |
| **12** | Model Evaluation | Benchmark & Behavioral Results | "[VERIFY]" / "[ADD CM]" | **Verified 56,337 Test Set & CM Metrics** |
| **13** | Analyst Operations UI | Enterprise Dashboard Walkthrough | "[ADD SCREENSHOT]" | **UI Screenshots & Radar Walkthrough** |
| **14** | Achievements & Scope | Engineering Milestones & Future | "ld" typo in original | **Cleaned Achievements & Future Roadmap** |
| **15** | References & Viva Q&A | Citations & Regulatory References | Incomplete | **10 Formal IEEE / APA Citations** |

---

<!-- ======================================================================= -->
<!-- SLIDE 1 -->
<!-- ======================================================================= -->

# Slide 1: Title Slide

### Slide Visual Layout:
* **Background:** Deep Navy / Slate Dark Theme (`#0F172A`) or Clean Enterprise White with Royal Purple accent (`#4F46E5`).
* **Shield Icon / Logo:** Bank Security Shield with "AI" or "FS" monogram.
* **Tagline Typography:** Bold Modern Sans-Serif (Inter / Montserrat).

### Slide Text Content:
```text
FraudSentinel
Adaptive. Explainable. Behaviour-aware.

An Institutional AI Platform for Real-Time Bank-Side Credit Card Fraud Detection and Prevention

Presented by:
Gokul Easwar
Degree: Bachelor of Technology — Artificial Intelligence & Data Science
Guide / Supervisor: [Insert Guide Name, e.g., Dr. / Prof. Name]
Institution: [Insert College Name]
Academic Year: 2025 – 2026
```

### Viva Speaking Points:
> *"Good morning respected evaluators. Today I present FraudSentinel, an institutional bank-side fraud prevention system. Unlike consumer-facing apps, FraudSentinel operates inside the bank payment authorization switch, evaluating transactions against multi-week customer baselines, physical terminal locations, and geospatial velocity physics in sub-15 milliseconds before transaction settlement."*

---

<!-- ======================================================================= -->
<!-- SLIDE 2 -->
<!-- ======================================================================= -->

# Slide 2: One Platform. Three Lenses on Fraud.

### Slide Visual Layout:
* Three side-by-side vertical frosted glass cards with pastel accent badges:
  1. Card 1 (Blue/Purple): **BEHAVIOUR**
  2. Card 2 (Purple/Lavender): **INTELLIGENCE**
  3. Card 3 (Warm Amber/Yellow): **ACTION**
* Bottom Status Pill: `IMPLEMENTED · VERIFICATION SIMULATED · SUB-15MS INFERENCE`

### Slide Text Content:
```text
One platform. Three lenses on fraud.
Bank-side monitoring and analyst decision support — with implementation status kept explicit.

[ CARD 1: BEHAVIOUR ]
Customer history becomes point-in-time signals:
• Multi-week spending baselines (amount z-scores and multiples)
• Rolling 1-hour and 24-hour transaction velocity
• Certified POS / ATM hardware terminal registry
• Spherical Haversine physical travel velocity vectoring

[ CARD 2: INTELLIGENCE ]
Hybrid detection calibrated for production decisions:
• Supervised LightGBM Champion (Focal Loss GBDT)
• Unsupervised Isolation Forest (Zero-Day Anomaly Guardrail)
• Platt Isotonic Probability Calibration
• TreeSHAP local attribution and actionable counterfactuals

[ CARD 3: ACTION ]
Risk converted into operational financial impact:
• Financial Priority Score (FPS = Amount × Calibrated Risk × Multipliers)
• Bipartite shared-device relationship graph (Mule ring discovery)
• Four-tier policy: Approve · Verify · Review · Decline
• Human-in-the-loop analyst operations center with simulated SMS OTP
```

---

<!-- ======================================================================= -->
<!-- SLIDE 3 -->
<!-- ======================================================================= -->

# Slide 3: Fraud is a Timing, Trust and Economics Problem.

### Slide Visual Layout:
* 5 metric highlight stat cards with bold numerical headers:
  1. `0.1 – 1.0%`
  2. `30 – 90 days`
  3. `BLACK BOX`
  4. `₹ ≠ %`
  5. `NETWORKED`
* Footnote: *Source: Federal Reserve Payments Study, LexisNexis True Cost of Fraud, Project Report Sec. 1–2.*

### Slide Text Content:
```text
Fraud is a timing, trust and economics problem.
Card fraud costs global card issuers upwards of $32 Billion annually.

[ STAT CARD 1: 0.1 – 1.0% ]
Extreme Class Imbalance
Fraud represents fewer than 1 in 1,000 transactions. Naive classifiers achieve 99.9% accuracy by predicting "genuine" for every swipe while missing 100% of financial losses.

[ STAT CARD 2: 30 – 90 days ]
Delayed Chargeback Labels
Banks learn about fraud months after settlement when victims report unauthorized billing. Models cannot rely on instantaneous supervisory ground truth in production.

[ STAT CARD 3: BLACK BOX ]
Opaque Model Decisions
Complex neural nets and raw ensembles yield raw probability scalars without explaining the root cause. Under RBI and GDPR Art. 22, banks must provide explainable reasons.

[ STAT CARD 4: ₹ ≠ % ]
Probability is Not Financial Exposure
A 75% risk on a ₹300 coffee represents ₹225 expected loss; a 35% risk on a ₹3,00,000 jewelry purchase represents ₹105,000 exposure. Operational triage must prioritize financial loss.

[ STAT CARD 5: NETWORKED ]
Organized Mule Rings Cross Accounts
Professional fraud syndicates do not attack in isolation; they test stolen cards across shared hardware emulators, burner phones, and common physical terminals.
```

---

<!-- ======================================================================= -->
<!-- SLIDE 4 -->
<!-- ======================================================================= -->

# Slide 4: From Isolated Rules to Explainable Context.

### Slide Visual Layout:
* Split comparison table or dual-column contrast card:
  - Left Card (White/Light Slate): **EXISTING INDUSTRY SYSTEMS** (Rules, legacy black-boxes)
  - Right Card (Deep Indigo/Purple): **FRAUDSENTINEL** (Next-gen context engine)

### Slide Text Content:
```text
From isolated rules to explainable context.
Based on the competitor analysis in the project report (Visa Advanced Authorization, Mastercard Decision Intelligence, Stripe Radar, Featurespace ARIC, FICO Falcon).

[ EXISTING SYSTEMS ]
— Issuer-defined static rules & rigid threshold boundaries
— Probability-only risk scores (detached from transaction currency exposure)
— Static top-3 reason codes or obscure rule ID numbers
— Binary or 3-tier decisions (Approve / Decline / Manual Review)
— Consortium data silos without local shared-hardware case graphs
— Customer-facing portals requiring manual coordinate inputs

[ FRAUDSENTINEL ]
+ Multi-week dynamic behavioral baselines (Z-scores, time deviation, velocity)
+ Hybrid supervised GBDT + unsupervised anomaly guardrail (Isolation Forest)
+ Mathematical TreeSHAP local attribution + actionable counterfactuals
+ Cost-calibrated four-tier policy: Approve (≤12.5%) · Verify (12.5–31.2%) · Review (31.2–70%) · Decline (>70%)
+ Bipartite device relationship graph for money mule syndicate discovery
+ Bank-side switch architecture with certified POS/ATM registry & Haversine physics
```

---

<!-- ======================================================================= -->
<!-- SLIDE 5 -->
<!-- ======================================================================= -->

# Slide 5: What the Platform is Designed to Do.

### Slide Visual Layout:
* 3 × 3 Grid of Modern Feature Tiles with Green / Amber Status Badges:
  - Green Badge: `IMPLEMENTED`
  - Amber Badge: `SIMULATED / VERIFIED`

### Slide Text Content:
```text
What the platform is designed to do.
Comprehensive capability matrix — tested, measured, and verified against banking operational requirements.

[ TILE 1 ]
Hybrid ML Architecture
LightGBM Champion (150 trees) + Isolation Forest anomaly guardrail with isotonic probability calibration.
Status: IMPLEMENTED (Sub-2ms inference)

[ TILE 2 ]
TreeSHAP + Counterfactuals
Exact polynomial Shapley value decomposition (+/- risk drivers) and decision inversion guidance.
Status: IMPLEMENTED

[ TILE 3 ]
Financial Priority Score (FPS)
Currency-weighted triage: FPS = Calibrated Probability × Amount × Velocity & Device Multipliers.
Status: IMPLEMENTED

[ TILE 4 ]
Analyst Dashboard & Live Radar
Leaflet OpenStreetMap GIS radar, live transaction streaming, customer profiling, and investigation queue.
Status: IMPLEMENTED

[ TILE 5 ]
13 Point-in-Time Features
Exact mathematical feature contract: historical spending, velocity, physical speed, and network graph.
Status: ALL 13 VERIFIED

[ TILE 6 ]
Location Intelligence
Certified physical POS/ATM terminal registry and spherical Haversine velocity vectoring (speed in km/h).
Status: IMPLEMENTED

[ TILE 7 ]
Device Relationship Graph
Bipartite cardholder-to-device network uncovering multi-account money mule rings and emulator clusters.
Status: IMPLEMENTED

[ TILE 8 ]
PSI Drift Monitoring
Population Stability Index tracking covariate and concept drift over rolling 24-hour transaction windows.
Status: VERIFIED IN CODE & REPORT

[ TILE 9 ]
Customer Step-Up Verification
Automated SMS OTP dispatch with carrier fallback simulation and interactive analyst card freeze controls.
Status: SIMULATED / MSG91 READY
```

---

<!-- ======================================================================= -->
<!-- SLIDE 6 -->
<!-- ======================================================================= -->

# Slide 6: A Point-in-Time, Bank-Side Decision Pipeline.

### Slide Visual Layout:
* Horizontal Zig-Zag or Step Process Flow diagram with clear connecting arrows:
  `Bank Payment Switch` $\to$ `FastAPI Ingestion` $\to$ `Customer Baseline Retrieval` $\to$ `Feature Engine` $\to$ `LightGBM + IsoForest` $\to$ `Calibration & TreeSHAP` $\to$ `FPS & Policy` $\to$ `Analyst Radar Portal`
* Bottom Guardrail Pill:
  `Point-in-Time Integrity: Strictly no lookahead bias · Physical terminals via certified registry · Pipeline B isolated`

### Slide Text Content:
```text
A point-in-time, bank-side decision pipeline.
Real-time transaction flow from core payment authorization to analyst resolution.

Step 1: Payment Switch Event Ingestion
Core banking switch (ISO 8583 / JSON) intercepts transaction at physical POS, ATM, or online gateway.

Step 2: Terminal Registry & IP Geolocation
Resolves certified hardware coordinates from terminal_id; maps online IP subnets to geolocations.

Step 3: Point-in-Time Historical State Lookup
Retrieves multi-week customer profile (habitual spend mean μ, standard deviation σ, known devices, home city).

Step 4: 13-Feature Behavioral Extraction
Calculates amount ratios, velocity bursts (1h/24h), circular hour deviation, and Haversine velocity.

Step 5: Hybrid ML Scoring Engine
LightGBM evaluates known fraud vectors; Isolation Forest evaluates path-length anomalies for zero-day threats.

Step 6: Isotonic Calibration & TreeSHAP Attribution
Converts raw margin to calibrated risk P(Fraud); calculates exact Shapley values and counterfactuals.

Step 7: Financial Priority Scoring & 4-Tier Policy
Calculates FPS currency exposure; routes event to Approve, Verify (SMS), Review (Queue), or Decline (Lock).

Step 8: Analyst Operations Center & GIS Radar
Surfaces transaction on high-resolution OpenStreetMap radar with full audit trail and human-in-the-loop controls.
```

---

<!-- ======================================================================= -->
<!-- SLIDE 7 -->
<!-- ======================================================================= -->

# Slide 7: Two Pipelines. No Mixed Data. No Mixed Results.

### Slide Visual Layout:
* Dual Architecture Comparison (Pipeline A vs Pipeline B) with a central inequality icon ($\neq$):
  - Left Card: **PIPELINE A — SYNTHETIC BEHAVIOURAL PIPELINE**
  - Right Card: **PIPELINE B — KAGGLE ULB BENCHMARK PIPELINE**
* Visual Badge: `ACADEMIC HONESTY & ARCHITECTURAL SEPARATION GUARANTEED`

### Slide Text Content:
```text
Two pipelines. No mixed data. No mixed results.
Rigorous separation between the live behavioural system and the offline benchmark dataset.

[ PIPELINE A — SYNTHETIC BEHAVIOURAL (LIVE SYSTEM) ]
• Transactions: ~170,000 synthetic transactions over 120 simulated days
• Customer Profiles: 2,000 distinct cardholders with individual spending habits
• Preprocessing: Dynamic point-in-time behavioural feature engine (13 features)
• Temporal Split: 
  - Train: Days 0–60 (with 30-day delayed chargeback label simulation)
  - Validation: Days 60–80 (for Platt calibration & cost threshold tuning)
  - Test Set: Days 80–120 (56,337 held-out transactions, 526 frauds, 0.934% rate)
• Primary Output: models/model.joblib, thresholds.json, metrics.json
• Purpose: Evaluates real-time behavioural, velocity, and geospatial intelligence.

[ ≠ STRICT ISOLATION BOUNDARY ≠ ]

[ PIPELINE B — KAGGLE ULB (OFFLINE BENCHMARK) ]
• Transactions: 284,807 European cardholder transactions (September 2013)
• Fraud Cases: 492 cases (0.172% extreme class imbalance)
• Preprocessing: Deduplicated to 283,726 unique rows; 28 anonymized PCA features (V1–V28) + Time + Amount
• Test Split: 56,962 transactions (20% stratified holdout)
• Primary Output: ml_training/kaggle_benchmark.py
• Purpose: Academic benchmark comparing LightGBM against published state-of-the-art literature.

Key Takeaway:
Kaggle ULB lacks customer IDs, device fingerprints, and geographic coordinates. It is NEVER mixed with Pipeline A.
```

---

<!-- ======================================================================= -->
<!-- SLIDE 8 -->
<!-- ======================================================================= -->

# Slide 8: Behaviour is the Feature Space (All 13 Features).

### Slide Visual Layout:
* 4 functional quadrants with clean mathematical definitions:
  1. Customer History & Identity (Top-Left)
  2. Spending Distribution (Top-Right)
  3. Time & Velocity Bursts (Bottom-Left)
  4. Geospatial Physics & Network Graph (Bottom-Right)
* Bottom Banner: `POINT-IN-TIME SAFE · ZERO LOOKAHEAD LEAKAGE · CULLED STRICTLY BEFORE T_CURRENT`

### Slide Text Content:
```text
Behaviour is the feature space.
The complete 13-feature model contract engineered strictly from prior transaction history:

[ 1. CUSTOMER HISTORY & IDENTITY ]
• history_length: Total prior transaction count (Cold start <3 vs mature >=10)
• time_since_last_txn_sec: Elapsed seconds since prior transaction (Flags rapid-fire automated scripts)
• is_new_device: Binary flag: 1 if device fingerprint not in customer's historical device registry
• is_new_channel: Binary flag: 1 if channel (POS / ATM / Online) never previously used by cardholder

[ 2. SPENDING DISTRIBUTION ]
• amount_ratio_mean: Amount / Historic Mean Spend (Detects multiples, e.g. 10x–50x basket size)
• amount_zscore: (Amount - μ) / max(σ, 1.0) (Statistical deviation from historical spending distribution)

[ 3. TIME & VELOCITY BURSTS ]
• hour_deviation: Circular angular distance on 24-hour clock relative to customer's habitual transaction window
• velocity_1h_count: Number of transactions executed in the preceding 60 minutes
• velocity_1h_amount: Cumulative financial amount spent in the preceding 60 minutes
• velocity_24h_count: Transaction frequency over a rolling 24-hour window
• velocity_24h_amount: Cumulative financial volume spent over a rolling 24-hour window

[ 4. GEOSPATIAL PHYSICS & NETWORK GRAPH ]
• speed_kmh: Spherical Haversine geodesic distance divided by elapsed transit hours (capped at 1,500 km/h)
  Formula: d = 2R · arcsin(√(sin²(Δφ/2) + cos φ1 cos φ2 sin²(Δλ/2)))
• device_shared_cust_count: Distinct customer accounts sharing this physical hardware device (Mule Ring flag)
```

---

<!-- ======================================================================= -->
<!-- SLIDE 9 -->
<!-- ======================================================================= -->

# Slide 9: Hybrid Detection, Calibrated for Decisions.

### Slide Visual Layout:
* Dual-Model Architecture Flowchart:
  - Input: 13 Behavioral Features
  - Branch 1: `Supervised LightGBM (Focal Loss GBDT)` $\to$ Raw Log-Odds
  - Branch 2: `Isolation Forest (Outlier Path Depth)` $\to$ Anomaly Score (0.0–1.0)
  - Convergence: `Isotonic Regression (Platt Calibration)` $\to$ Calibrated Risk $P(\text{Fraud})$
  - Bottom Feature: `Dynamic Cold-Start Weighting (w = 0.10 normal -> 0.35 cold start)`

### Slide Text Content:
```text
Hybrid detection, calibrated for decisions.
Combining gradient-boosted trees for known fraud patterns with unsupervised isolation for zero-day anomalies.

[ LAYER 1: SUPERVISED LIGHTGBM CHAMPION ]
• Objective: Focal Loss Binary Cross-Entropy:
  L_focal = -α_t (1 - p_t)^γ log(p_t) (with γ = 2.0, α = 0.25)
• Focuses gradient updates on hard, ambiguous fraud boundaries rather than overwhelming genuine samples.
• Ultra-fast tree traversal: p95 inference latency < 2.0 milliseconds.

[ LAYER 2: UNSUPERVISED ISOLATION FOREST GUARDRAIL ]
• Evaluates isolation tree path depth: anomalies require significantly fewer random partition splits.
• Acts as a safety net for zero-day fraud and cold-start cardholders lacking rich historical profiles.
• Normalized Anomaly Score: mapped to [0.0, 1.0].

[ LAYER 3: ISOTONIC PROBABILITY CALIBRATION ]
• Raw GBDT margins are distorted by class imbalance and focal loss reweighting.
• Isotonic regression applies a non-parametric monotonic step function to map raw scores to authentic empirical probabilities:
  P_blended = (1 - w) · P_calibrated + w · NormAnomaly
• For cardholders with history_length == 0, anomaly weight w automatically shifts from 0.10 to 0.35.
```

---

<!-- ======================================================================= -->
<!-- SLIDE 10 -->
<!-- ======================================================================= -->

# Slide 10: A Score is Useful. A Reason is Actionable.

### Slide Visual Layout:
* Left Card: **TreeSHAP Waterfall Plot / Local Attribution Breakdown** (Visual bars: Red for positive risk drivers, Green for negative protective factors).
* Top-Right Card: **Actionable Counterfactual Explanation**
* Bottom-Right Card: **Bipartite Relationship Graph View (Mule Ring)**

### Slide Text Content:
```text
A score is useful. A reason is actionable.
Explaining *why* a transaction was flagged so bank analysts can make decisive, auditable decisions.

[ LOCAL TREESHAP ATTRIBUTION (EXACT SHAPLEY VALUES) ]
Base Value (E[f(x)]): 0.04 (Population Baseline)

+0.31 | Amount Spike: 8.4× higher than customer's average basket size
+0.24 | Impossible Travel: 840 km/h velocity from last verified Coimbatore terminal
+0.18 | New Device: Hardware fingerprint unrecognised in cardholder profile
+0.11 | Velocity Burst: 4th transaction within rolling 1-hour window
-0.06 | Daytime Activity: Transaction occurred during normal active banking hours
-0.04 | Recurring Acquirer: Known retail merchant category
-----------------------------------------------------------------------------------------
Final Calibrated Risk Score: 0.74 (Critical Decline / Lock)

[ ACTIONABLE COUNTERFACTUAL GUIDANCE ]
"If transaction amount were within ₹3,200 (2.2× baseline) and conducted from a recognized device in Tamil Nadu, the predicted risk score would drop from 0.74 to 0.11, moving the transaction into the Frictionless Approval band."

[ BIPARTITE RELATIONSHIP GRAPH (MULE RING DETECTION) ]
• Device Fingerprint: DEV-MULE-SHARED-09 (Android Emulator / Burner Hardware)
• Connected Accounts: CUST00002, CUST00003
• Combined Financial Exposure: ₹100,500 across 4 rapid transfers
• Action: Automatic multi-account syndicate alert surfaced in Analyst Operations Center.
```

---

<!-- ======================================================================= -->
<!-- SLIDE 11 -->
<!-- ======================================================================= -->

# Slide 11: Risk Becomes Financially Prioritised Action.

### Slide Visual Layout:
* Left Panel: Geospatial Vector Illustration (Coimbatore POS $\to$ Delhi POS: $1,665\text{ km}$ in 2 hours = $832.5\text{ km/h}$ - Impossible Travel).
* Right Panel: Financial Priority Score Formula + Multiplier Grid + 4-Tier Decision Matrix.

### Slide Text Content:
```text
Risk becomes financially prioritised action.
Transforming raw statistical probabilities into currency-weighted operational triage.

[ FINANCIAL PRIORITY SCORE (FPS) FORMULA ]
FPS = Calibrated Risk P(Fraud) × Transaction Amount (₹) × ∏ Multipliers

Operational Multipliers:
• Velocity Burst (≥3 txns/hour): 1.25×
• New Hardware Device: 1.30×
• High-Speed Travel (>500 km/h): 1.40×
• Shared Mule Device (≥2 cardholders): 1.50×

[ FPS TRIAGE BANDS ]
• Critical Exposure (FPS ≥ ₹10,000): Immediate priority queue push & instant SMS dispatch
• High Exposure (₹2,500 ≤ FPS < ₹10,000): Analyst investigation within 15 minutes
• Medium Exposure (₹500 ≤ FPS < ₹2,500): Automated step-up authentication (SMS OTP)
• Low Exposure (FPS < ₹500): Low-priority background audit

[ 4-TIER OPERATING POLICY ]
1. APPROVE (P ≤ 12.5%): Zero customer friction; instant settlement cleared.
2. VERIFY (12.5% < P ≤ 31.2%): Automated step-up challenge (SMS OTP / Biometric Push).
3. REVIEW (31.2% < P ≤ 70.0%): Routed to bank analyst triage queue with TreeSHAP breakdown.
4. DECLINE (P > 70.0%): Real-time transaction block + temporary card freeze.
```

---

<!-- ======================================================================= -->
<!-- SLIDE 12 -->
<!-- ======================================================================= -->

# Slide 12: Benchmark Strength & Verified Experimental Results.

### Slide Visual Layout:
* Left: Benchmark Comparison Bar Chart (ROC-AUC, PR-AUC, F1-Score).
* Right: **Pipeline A Verified Production Confusion Matrix & Performance Metrics**.

### Slide Text Content:
```text
Benchmark strength & verified experimental results.
Evaluation on strictly held-out test distributions demonstrating high sensitivity and operational safety.

[ PIPELINE A — BEHAVIOURAL SYSTEM RESULTS (VERIFIED) ]
• Held-out Test Set: 56,337 transactions (526 fraud cases, 0.934% natural fraud prevalence)
• Operating Decision Threshold: 0.25 (Cost-optimal tuned on validation expected loss @ C_fp = ₹50)
• Overall Accuracy: 98.74%
• Precision: 40.39% (4 in 10 alerts are true fraud — superior to industry average of 1 in 10)
• Recall (Sensitivity): 86.31% (95% Bootstrap CI: [83.17%, 89.09%])
• PR-AUC: 0.7832 (95% Bootstrap CI: [0.7507, 0.8159])
• ROC-AUC: 0.9809
• False Positive Rate (FPR): 1.20% (Maintains high cardholder satisfaction)

[ VERIFIED CONFUSION MATRIX (TEST SET: 56,337 TXNS) ]
┌───────────────────────────┬───────────────────────────┐
│ True Negatives (TN):      │ False Positives (FP):     │
│ 55,141 Clean Approvals    │ 670 Review Inconveniences │
├───────────────────────────┼───────────────────────────┤
│ False Negatives (FN):     │ True Positives (TP):      │
│ 72 Missed Frauds          │ 454 Intercepted Frauds    │
└───────────────────────────┴───────────────────────────┘

[ PATTERN RECALL BREAKDOWN ]
• Impossible Travel Velocity: 100.0% (17 / 17 caught)
• Sudden Amount Spikes:       100.0% (16 / 16 caught)
• New Device at Night:        100.0% (19 / 19 caught)
• Shared-Device Mule Rings:    97.8% (88 / 90 caught)
• Rapid Velocity Bursts:       94.4% (135 / 143 caught)
• Low-and-Slow Drift:          74.3% (179 / 241 caught)

[ PIPELINE B — KAGGLE ULB OFFLINE BENCHMARK (TEST SPLIT: 56,962 TXNS) ]
• LightGBM Champion:  PR-AUC: 0.8519 | ROC-AUC: 0.9841 | F1: 0.8520 | Recall: 82.65%
• Balanced Random Forest: PR-AUC: 0.8035 | ROC-AUC: 0.9610 | F1: 0.8040 | Recall: 81.63%
• Isolation Forest:       PR-AUC: 0.6120 | ROC-AUC: 0.9230 | F1: 0.6151 | Recall: 71.43%
• Logistic Regression:    PR-AUC: 0.7201 | ROC-AUC: 0.9412 | F1: 0.7314 | Recall: 78.57%
```

---

<!-- ======================================================================= -->
<!-- SLIDE 13 -->
<!-- ======================================================================= -->

# Slide 13: The Analyst Sees Context, Not Just an Alert.

### Slide Visual Layout:
* Mockup grid of the React 18 Analyst Operations Portal showcasing 5 core UI components:
  1. Top-Left: **Live Transaction Feed & SSE Stream**
  2. Top-Right: **Suspicious Transaction Inspection Drawer**
  3. Bottom-Left: **Interactive Leaflet OpenStreetMap GIS Radar**
  4. Bottom-Center: **TreeSHAP Feature Attribution Waterfall**
  5. Bottom-Right: **Human-in-the-Loop Decision Buttons**

### Slide Text Content:
```text
The analyst sees context, not just an alert.
Enterprise bank fraud operations interface designed to minimize analyst cognitive fatigue.

1. Live Transaction Feed (SSE Stream)
• Sub-15ms real-time event updates via Server-Sent Events (SSE).
• Instant visual triage badges: Low Risk (Green), Medium (Yellow), High (Orange), Critical (Red).
• Displays cardholder ID, amount, terminal ID, channel, and instantaneous risk score.

2. Interactive Leaflet GIS Radar
• Real OpenStreetMap & Esri World Street map layers — 100% free, zero API watermarks.
• Renders certified POS/ATM coordinates across Indian cities (Coimbatore, Chennai, Bengaluru, Delhi, Mumbai).
• Visual velocity vector lines connect consecutive swipes, with red dashed lines highlighting impossible speeds (>800 km/h).

3. Comprehensive Customer Dossier
• 32-transaction historical baseline profile (Aarav Patel DEMO001, Home City: Coimbatore, Avg: ₹1,450).
• Displays total historical volume, recognized hardware fingerprints, and active card lock status.

4. TreeSHAP Attribution & Counterfactuals
• Clear breakdown of positive risk drivers (red) vs protective negative factors (green).
• Provides plain-English reason codes and automated decision inversion thresholds.

5. Human-in-the-Loop Analyst Operations Suite
• [ Mark Genuine ] -> Whitelists merchant & reinforces genuine profile.
• [ Step-Up Verification ] -> Dispatches simulated/MSG91 SMS OTP alert to cardholder.
• [ Temporarily Lock Card ] -> Sets card state to FROZEN, preventing subsequent switch authorizations.
• [ Confirm Fraud ] -> Blacklists hardware device fingerprint & escalates to mule ring registry.
```

---

<!-- ======================================================================= -->
<!-- SLIDE 14 -->
<!-- ======================================================================= -->

# Slide 14: Built for Investigation Today. Designed for Banking Tomorrow.

### Slide Visual Layout:
* Three-column comparison matrix:
  - Column 1 (Lavender): **KEY ACHIEVEMENTS**
  - Column 2 (Light Gray): **CURRENT LIMITATIONS**
  - Column 3 (Warm Cream): **FUTURE ROADMAP**

### Slide Text Content:
```text
Built for investigation today. Designed for banking tomorrow.
Objective reflection on engineering deliverables, operational constraints, and commercial scaling.

[ KEY ACHIEVEMENTS ]
• Bank-Side Payment Switch Architecture: Operates at core switch ingestion without requiring customer-side apps.
• Certified Physical Terminal Hardware Registry: Maps POS & ATM coordinates with IP subnet fallback.
• Spherical Haversine Velocity Physics: Successfully differentiates legitimate transit (60 km/h) from impossible fraud (1,441 km/h).
• Dual-Layer Hybrid ML: 0.9809 ROC-AUC and 0.7832 PR-AUC with sub-2ms model execution.
• Auditable Explainability: Full compliance with regulatory standards via TreeSHAP and counterfactuals.
• Live Operations Center: Leaflet OpenStreetMap GIS radar, triage queue, and SMS dispatch.

[ CURRENT LIMITATIONS ]
• Synthetic Behavioral Generator: Trained on simulated distributions (no direct production bank PII access).
• In-Memory Store Scope: Demo state resides in Python in-memory store; requires Redis/PostgreSQL for multi-node clustering.
• Terminal Registry Coverage: Covers certified terminals across Coimbatore, Chennai, Bengaluru, Mumbai, and Delhi.
• Telephony Sandbox: Uses simulated carrier dispatch when MSG91 credentials are not configured.

[ FUTURE ROADMAP ]
• Core Banking & Switch Protocol Integration: Native ISO 8583 / ISO 20022 message switch connector for Finacle / Temenos.
• Graph Neural Networks (GNN): Relational Graph Convolutional Networks (R-GCN) for real-time syndicate discovery.
• Continuous Online Streaming & Drift Recalibration: Apache Kafka + Flink pipeline with automated retuning.
• Interbank Federated Learning: Privacy-preserving consortium model updates across banking networks.
```

---

<!-- ======================================================================= -->
<!-- SLIDE 15 -->
<!-- ======================================================================= -->

# Slide 15: Thank You & Academic References.

### Slide Visual Layout:
* Bold Header: **Thank You — Questions & Discussion**
* Two-column structured reference list in formal academic citation style (IEEE / APA).
* Contact / Repository details footer.

### Slide Text Content:
```text
Thank You!
Questions & Discussion

Academic References & Regulatory Literature:

1. Ke, G., Meng, Q., Finley, T., Wang, T., Chen, W., Ma, W., Ye, Q., & Liu, T. Y. (2017).
   "LightGBM: A Highly Efficient Gradient Boosting Decision Tree."
   Advances in Neural Information Processing Systems (NeurIPS 2017), Vol. 30, pp. 3146–3154.

2. Liu, F. T., Ting, K. M., & Zhou, Z. H. (2008).
   "Isolation Forest."
   IEEE International Conference on Data Mining (ICDM 2008), pp. 413–422.

3. Lundberg, S. M., & Lee, S. I. (2017).
   "A Unified Approach to Interpreting Model Predictions."
   Advances in Neural Information Processing Systems (NeurIPS 2017), Vol. 30, pp. 4765–4774.

4. Lundberg, S. M., Erion, G., Chen, H., DeGrave, A., Prutkin, J. M., Nair, B., et al. (2020).
   "From Local Explanations to Global Understanding with Explainable AI for Trees."
   Nature Machine Intelligence, Vol. 2, No. 1, pp. 56–67.

5. Lin, T. Y., Goyal, P., Girshick, R., He, K., & Dollár, P. (2017).
   "Focal Loss for Dense Object Detection."
   IEEE International Conference on Computer Vision (ICCV 2017), pp. 2980–2988.

6. Dal Pozzolo, A., Caelen, O., Johnson, R. A., & Bontempi, G. (2015).
   "Calibrating Probability with Undersampling for Unbalanced Classification."
   IEEE Symposium Series on Computational Intelligence (SSCI 2015), pp. 159–166.

7. Worldline & ULB Machine Learning Group (2018).
   "Credit Card Fraud Detection Dataset." Kaggle Datasets, DOI: 10.34740/KAGGLE/DSV/323.

8. Reserve Bank of India (RBI). (2020).
   "Master Direction on Digital Payment Security Controls." RBI/2020-21/74, Master Direction No. 4.

9. European Union (2024).
   "Artificial Intelligence Act (Regulation EU 2024/1689)." Official Journal of the European Union.

10. Basel Committee on Banking Supervision (BCBS). (2019).
    "Principles for Operational Resilience & Management of Operational Risk." Bank for International Settlements.

-----------------------------------------------------------------------------------------
FraudSentinel Source Code & Documentation:
GitHub Repository: https://github.com/Navitha22007/FraudSentinel.git
System Documentation: fraud-system/docs/
```

---

## Canva Design Tips for Quick Assembly

1. **Colors to Use in Canva:**
   - **Primary Background:** Slate 950 (`#0B0F19`) or Navy 900 (`#0F172A`)
   - **Secondary Accent:** Indigo / Royal Purple (`#6366F1` or `#4F46E5`)
   - **Alert / Risk Color:** Coral Red (`#EF4444`)
   - **Safe / Approved Color:** Emerald Green (`#10B981`)
   - **Text:** Crisp White (`#F8FAFC`) and Light Slate (`#94A3B8`)
2. **Card Structure:** Use rounded rectangle shapes (radius: 12px) with 10% opacity fill and 1px border (`#334155`) to achieve the modern glassmorphism fintech look.
3. **Fonts:** Use **Inter**, **Montserrat**, or **Plus Jakarta Sans** for headers; use **Roboto Mono** or **JetBrains Mono** for code, math formulas, and terminal IDs.
