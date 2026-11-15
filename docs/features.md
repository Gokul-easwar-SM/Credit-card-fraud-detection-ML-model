# Behavioural Feature Engineering Specification

The feature pipeline produces a 13-dimensional numerical representation of each transaction based **strictly on historical transactions prior to the current transaction timestamp** (`occurred_at`). There is zero lookahead leakage.

## 1. Feature Registry (`FEATURE_NAMES`)

| Feature | Type | Units / Range | Cold-Start Fallback | Formula / Description |
|---|---|---|---|---|
| `history_length` | Float | $[0, \infty)$ | `0.0` | Count of strictly prior transactions recorded for this customer. |
| `amount_zscore` | Float | $(-\infty, \infty)$ | `0.0` | $\frac{\text{amount} - \mu_{\text{prior}}}{\sigma_{\text{prior}}}$. Fallback to `0.0` if `history_length < 2` or $\sigma < 10^{-6}$. |
| `amount_ratio_mean` | Float | $[0, \infty)$ | `1.0` | $\frac{\text{amount}}{\mu_{\text{prior}}}$. Fallback to `1.0` if `history_length == 0`. |
| `hour_deviation` | Float | $[0, 12.0]$ hours | `0.0` | Shortest circular distance on a 24-hour clock between the transaction hour and the customer's prior circular mean hour. |
| `time_since_last_txn_sec` | Float | $[0, \infty)$ seconds | `2592000.0` (30 days) | Elapsed seconds since the immediately previous transaction for this customer. |
| `velocity_1h_count` | Float | $[0, \infty)$ | `0.0` | Count of transactions by this customer in $[t - 1\text{h}, t)$. |
| `velocity_1h_amount` | Float | $[0, \infty)$ currency | `0.0` | Sum of transaction amounts by this customer in $[t - 1\text{h}, t)$. |
| `velocity_24h_count` | Float | $[0, \infty)$ | `0.0` | Count of transactions by this customer in $[t - 24\text{h}, t)$. |
| `velocity_24h_amount` | Float | $[0, \infty)$ currency | `0.0` | Sum of transaction amounts by this customer in $[t - 24\text{h}, t)$. |
| `speed_kmh` | Float | $[0, 1500.0]$ km/h | `0.0` | Haversine distance from previous transaction location divided by hours elapsed. Capped at 1500 km/h. |
| `is_new_device` | Float | $\{0.0, 1.0\}$ | `1.0` if online | `1.0` if `device_key` is non-null and has never been seen before for this customer; `0.0` otherwise. |
| `is_new_channel` | Float | $\{0.0, 1.0\}$ | `1.0` | `1.0` if `channel` has never been used before by this customer; `0.0` otherwise. |
| `device_shared_cust_count` | Float | $[0, \infty)$ | `0.0` | Number of distinct customers observed using this `device_key` across the entire system strictly prior to $t$. |

---

## 2. Temporal Contract & Leakage Rules

1. **Strict inequality**: All historical subsets enforce $t_{\text{prior}} < t_{\text{current}}$. Current and future events are never accessible.
2. **Batch / Single parity**: Features computed over a static DataFrame during training are bit-for-bit identical to features generated row-by-row during real-time scoring.
3. **No NaNs or Infs**: All missing or undefined historical metrics fall back to documented, finite values.
4. **Validation enforcement**: Input transactions must have positive amounts, valid Indian or global geographic coordinates, and recognised channels (`pos`, `online`, `atm`).
