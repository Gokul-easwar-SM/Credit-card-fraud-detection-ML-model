"""Trained model pipeline definition, score calibration, and prediction.

Provides:
- ScoreCalibrator: Platt (Sigmoid) or Isotonic calibrator.
- TrainedPipeline: Dataclass wrapping supervised model, calibrator, anomaly model, and threshold logic.
- sys.modules compatibility shim for unpickling models saved under ml_training.train.
"""
from __future__ import annotations

import sys
import types
from dataclasses import dataclass
from typing import Any

import numpy as np
import pandas as pd
from sklearn.isotonic import IsotonicRegression
from sklearn.linear_model import LogisticRegression


class ScoreCalibrator:
    """Platt (Sigmoid) or Isotonic probability calibration."""

    def __init__(self, method: str = "sigmoid") -> None:
        self.method = method
        self.calibrator = (
            LogisticRegression()
            if method == "sigmoid"
            else IsotonicRegression(out_of_bounds="clip")
        )

    def fit(self, raw_probs: np.ndarray, y: Any) -> ScoreCalibrator:
        p = np.asarray(raw_probs, dtype=float)
        y_arr = np.asarray(y, dtype=int)
        if self.method == "sigmoid":
            self.calibrator.fit(p.reshape(-1, 1), y_arr)
        else:
            self.calibrator.fit(p, y_arr)
        return self

    def predict(self, raw_probs: np.ndarray) -> np.ndarray:
        p = np.asarray(raw_probs, dtype=float)
        if self.method == "sigmoid":
            return self.calibrator.predict_proba(p.reshape(-1, 1))[:, 1]
        else:
            return np.clip(self.calibrator.predict(p), 0.0, 1.0)


@dataclass
class TrainedPipeline:
    supervised_model: Any
    calibrated_model: Any
    anomaly_model: Any
    baseline_lr: Any
    baseline_rf: Any
    thresholds: dict[str, Any]
    feature_names: tuple[str, ...]
    anomaly_min: float
    anomaly_max: float
    blend_weight: float = 0.10

    def predict_proba(self, X: pd.DataFrame) -> np.ndarray:
        """Compute calibrated probability blended with anomaly score."""
        X_mat = X[list(self.feature_names)]
        p_raw = self.supervised_model.predict_proba(X_mat)[:, 1]
        p_cal = self.calibrated_model.predict(p_raw)

        # Anomaly score: -decision_function, higher = more anomalous
        raw_anomaly = -self.anomaly_model.decision_function(X_mat)
        norm_anomaly = np.clip(
            (raw_anomaly - self.anomaly_min) / max(self.anomaly_max - self.anomaly_min, 1e-6),
            0.0,
            1.0,
        )

        # Blend: for cold start (history_length == 0), give higher weight to anomaly
        hist_len = X_mat["history_length"].values if "history_length" in X_mat.columns else np.ones(len(X_mat))
        w = np.where(hist_len == 0, 0.35, self.blend_weight)
        blended = (1.0 - w) * p_cal + w * norm_anomaly
        return np.clip(blended, 0.0, 1.0)

    def predict_band(self, proba: np.ndarray | float) -> list[str] | str:
        """Assign risk band based on thresholds."""
        t_low = self.thresholds["threshold_low"]
        t_high = self.thresholds["threshold_high"]

        is_scalar = isinstance(proba, (float, int, np.floating))
        arr = np.asarray([proba]) if is_scalar else np.asarray(proba)

        bands = []
        for p in arr:
            if p < t_low:
                bands.append("low")
            elif p < t_high:
                bands.append("medium")
            else:
                bands.append("high")

        return bands[0] if is_scalar else bands



