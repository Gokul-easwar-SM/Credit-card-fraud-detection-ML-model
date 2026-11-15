"""Explainability engine: TreeSHAP local attributions to plain-English reason codes.

Translates mathematical SHAP attributions into clear, auditable bank analyst explanations
and generates counterfactual hints for human reviewers.
"""
from __future__ import annotations

from typing import Any, Mapping

import numpy as np
import pandas as pd

from app.ml.features import FEATURE_NAMES


class FraudExplainer:
    """Explains fraud predictions using TreeSHAP and generates plain-English reason codes."""

    def __init__(self, lgbm_model: Any, feature_names: tuple[str, ...] = FEATURE_NAMES) -> None:
        self.model = lgbm_model
        self.feature_names = list(feature_names)
        self._explainer: Any = None

    @property
    def explainer(self) -> Any:
        if self._explainer is None:
            import shap
            self._explainer = shap.TreeExplainer(self.model)
        return self._explainer

    def explain_transaction(
        self,
        features: Mapping[str, float],
        top_k: int = 3,
        threshold_high: float = 0.65,
    ) -> dict[str, Any]:
        """Generate SHAP values and human-readable reason codes for a transaction."""
        row_df = pd.DataFrame([features])[self.feature_names]
        shap_values = self.explainer.shap_values(row_df)

        # For binary classification, TreeExplainer returns list of arrays [class_0, class_1]
        # or single array for log-odds of positive class depending on SHAP version
        if isinstance(shap_values, list) and len(shap_values) == 2:
            sv = np.asarray(shap_values[1][0], dtype=float)
        elif isinstance(shap_values, np.ndarray) and shap_values.ndim == 3 and shap_values.shape[2] == 2:
            sv = np.asarray(shap_values[0, :, 1], dtype=float)
        elif isinstance(shap_values, np.ndarray) and shap_values.ndim == 2:
            sv = np.asarray(shap_values[0], dtype=float)
        else:
            sv = np.asarray(shap_values, dtype=float).flatten()

        shap_dict = {feat: float(sv[i]) for i, feat in enumerate(self.feature_names)}

        # Sort features by positive risk contribution (pushing toward fraud)
        pos_drivers = [
            (feat, shap_dict[feat], float(features.get(feat, 0.0)))
            for feat in self.feature_names
            if shap_dict[feat] > 0
        ]
        pos_drivers.sort(key=lambda x: x[1], reverse=True)

        # Sort features by negative risk contribution (pulling toward genuine)
        neg_drivers = [
            (feat, shap_dict[feat], float(features.get(feat, 0.0)))
            for feat in self.feature_names
            if shap_dict[feat] < 0
        ]
        neg_drivers.sort(key=lambda x: x[1])

        # Plain-English translations
        reason_codes: list[str] = []
        for feat, imp, val in pos_drivers[:top_k]:
            code_text = self._format_reason(feat, val)
            if code_text:
                reason_codes.append(code_text)

        if not reason_codes:
            reason_codes.append("Routine transaction profile: no high-risk behavioural anomalies detected.")

        # Counterfactual hint
        cf_hint = self._generate_counterfactual_hint(pos_drivers, features)

        return {
            "shap_values": shap_dict,
            "top_drivers": [
                {"feature": f, "shap_importance": round(imp, 4), "feature_value": val}
                for f, imp, val in pos_drivers[:top_k]
            ],
            "factors_increasing_risk": [
                {
                    "feature": f,
                    "shap_importance": round(imp, 4),
                    "feature_value": val,
                    "reason": self._format_reason(f, val),
                }
                for f, imp, val in pos_drivers[:top_k]
            ],
            "factors_reducing_risk": [
                {
                    "feature": f,
                    "shap_importance": round(imp, 4),
                    "feature_value": val,
                    "reason": self._format_reducing_reason(f, val),
                }
                for f, imp, val in neg_drivers[:top_k]
            ],
            "reason_codes": reason_codes,
            "counterfactual_hint": cf_hint,
        }

    def _format_reason(self, feat: str, val: float) -> str:
        if feat == "amount_ratio_mean" and val > 1.5:
            return f"Amount is {val:.1f}× higher than customer's average purchase size."
        if feat == "amount_zscore" and val > 2.0:
            return f"Transaction amount is {val:.1f} standard deviations above customer's typical spend."
        if feat == "speed_kmh" and val > 100.0:
            return f"Impossible physical travel speed ({val:.0f} km/h) from previous transaction location."
        if feat == "hour_deviation" and val > 2.0:
            return f"Unusual transaction time ({val:.1f} hours outside customer's regular activity window)."
        if feat == "is_new_device" and val == 1.0:
            return "New device: transaction executed from a device never before used by this customer."
        if feat == "is_new_channel" and val == 1.0:
            return "New payment channel: first transaction recorded on this payment rail for this customer."
        if feat == "device_shared_cust_count" and val >= 2.0:
            return f"Potential fraud ring: device previously used across {int(val)} other customer accounts."
        if feat == "velocity_1h_count" and val >= 3.0:
            return f"Rapid transaction burst: {int(val)} transactions attempted within the past hour."
        if feat == "velocity_1h_amount" and val > 1000.0:
            return f"High short-term velocity spend: ₹{val:,.2f} spent in the past 60 minutes."
        if feat == "velocity_24h_count" and val >= 5.0:
            return f"Elevated 24-hour frequency: {int(val)} transactions recorded within 24 hours."
        if feat == "time_since_last_txn_sec" and val < 120.0:
            return f"Extremely rapid repeat transaction (only {val:.0f} seconds since last event)."

        return f"Elevated risk attributed to {feat.replace('_', ' ')} (value: {val:.2f})."

    def _format_reducing_reason(self, feat: str, val: float) -> str:
        if feat == "is_new_device" and val == 0.0:
            return "Recognized device: transaction executed from customer's known, trusted device."
        if feat == "is_new_channel" and val == 0.0:
            return "Habitual channel: payment executed via customer's familiar transaction rail."
        if feat == "speed_kmh" and val < 60.0:
            return f"Plausible location: origin within normal physical travel velocity ({val:.1f} km/h)."
        if feat == "amount_ratio_mean" and val <= 1.2:
            return f"Familiar purchase amount ({val:.1f}× of customer's historical average)."
        if feat == "hour_deviation" and val <= 1.0:
            return "Standard timing: transaction occurred during customer's habitual activity hours."
        if feat == "velocity_1h_count" and val <= 1.0:
            return "Normal velocity: isolated transaction with no burst activity."
        if feat == "device_shared_cust_count" and val <= 1.0:
            return "Private device: hardware not associated with any other account."

        return f"Safe baseline pattern for {feat.replace('_', ' ')} (value: {val:.2f})."

    def _generate_counterfactual_hint(
        self,
        pos_drivers: list[tuple[str, float, float]],
        features: Mapping[str, float],
    ) -> str:
        if not pos_drivers:
            return "Transaction is already within safe boundaries."

        top_feat, _, top_val = pos_drivers[0]
        if top_feat == "amount_ratio_mean":
            return "If transaction amount were within 1.5× of the customer's average, risk score would drop significantly."
        if top_feat == "speed_kmh":
            return "If transaction originated from the customer's home region, travel velocity anomaly would be eliminated."
        if top_feat == "is_new_device":
            return "If transaction were executed from a recognised, registered device, device novelty flag would clear."
        if top_feat == "velocity_1h_count":
            return "If spacing between transactions exceeded 60 minutes, velocity burst risk would clear."
        if top_feat == "hour_deviation":
            return "If transaction occurred during normal daytime business hours, time anomaly would not trigger."

        return f"Reducing {top_feat.replace('_', ' ')} would lower overall risk score."
