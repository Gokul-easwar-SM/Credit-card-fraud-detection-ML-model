"""ML package for Credit Card Fraud Detection."""
from app.ml.features import (
    COLD_START_TIME_GAP_SEC,
    FEATURE_NAMES,
    MAX_SPEED_KMH,
    FeatureValidationError,
    compute_features_batch,
    compute_features_single,
    haversine_km,
    validate_transaction_record,
    validate_transactions_dataframe,
)
from app.ml.explain import FraudExplainer
from app.ml.pipeline import ScoreCalibrator, TrainedPipeline

__all__ = [
    "FEATURE_NAMES",
    "COLD_START_TIME_GAP_SEC",
    "MAX_SPEED_KMH",
    "FeatureValidationError",
    "FraudExplainer",
    "ScoreCalibrator",
    "TrainedPipeline",
    "compute_features_batch",
    "compute_features_single",
    "haversine_km",
    "validate_transaction_record",
    "validate_transactions_dataframe",
]
