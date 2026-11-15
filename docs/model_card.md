# Model Card: Behavioural Credit Card Fraud Detection Champion

## Model Details
- **Architecture**: LightGBM (150 trees, max depth 6) blended with Isolation Forest (cold start/novelty).
- **Calibration**: Platt Scaling (Sigmoid) on strictly post-training validation set.
- **Input Features**: 13 engineered behavioural signals (Z-scores, circular hour deviation, velocity, travel speed, device sharing).
- **Decision Thresholds** (optimized on validation expected loss):
  - Low Risk (< 0.125): Monitor
  - Medium Risk (0.125 – 0.312): Verify (SMS trigger)
  - High Risk (>= 0.312): Investigate (Analyst routing)

## Intended Use
- Academic prototype of an intelligent banking fraud monitoring department.
- Evaluates risk in real-time as transactions occur.
- **Disclaimer**: Not intended for real banking production. Uses simulated transactions where fraud is rule-generated.

## Quantitative Performance (Held-Out Test Set)
- **PR-AUC**: 0.7832 (95% CI: [0.7507, 0.8159])
- **ROC-AUC**: 0.9809
- **Precision**: 0.4039
- **Recall**: 0.8631 (95% CI: [0.8317, 0.8909])
- **F1 Score**: 0.5503 (95% CI: [0.5206, 0.5799])
- **False Positive Rate**: 0.01200

### Confusion Matrix
| | Predicted Genuine | Predicted Fraud |
|---|---|---|
| **Actual Genuine** | 55,141 (TN) | 670 (FP) |
| **Actual Fraud** | 72 (FN) | 454 (TP) |

### Recall per Fraud Pattern
| Fraud Pattern | Incidents | Flagged | Recall |
|---|---|---|---|
| `amount_spike` | 16 | 16 | 100.0% |
| `impossible_travel` | 17 | 17 | 100.0% |
| `low_and_slow` | 241 | 179 | 74.3% |
| `new_device_night` | 19 | 19 | 100.0% |
| `shared_device_ring` | 90 | 88 | 97.8% |
| `velocity_burst` | 143 | 135 | 94.4% |

### Ablation Study
| Model Pipeline | PR-AUC | F1 | Recall | Precision |
|---|---|---|---|---|
| 1_logistic_regression | 0.3450 | 0.0233 | 0.9639 | 0.0118 |
| 2_random_forest | 0.7686 | 0.5595 | 0.8270 | 0.4227 |
| 3_lightgbm_raw | 0.8180 | 0.1155 | 0.9392 | 0.0615 |
| 4_lightgbm_calibrated | 0.8180 | 0.6456 | 0.8536 | 0.5191 |
| 5_champion_blended | 0.7832 | 0.5503 | 0.8631 | 0.4039 |

## Ethical Considerations & Limitations
- **Synthetic Data Bias**: Since fraud patterns were generated with synthetic rules, model accuracy is optimistic compared to real bank streams.
- **Cost Assumption**: Cost optimization assumes ₹50 review cost per false positive and actual transaction amount for false negatives.
- **Privacy**: No PII, passwords, CVV, or real account numbers are present or stored.