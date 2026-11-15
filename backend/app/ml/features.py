"""Behavioural feature engineering pipeline for credit card fraud detection.

Shared between offline model training and online real-time inference.
All features are computed from strictly earlier transactions only (no lookahead leakage).

Features:
  1. history_length: count of strictly earlier transactions for this customer.
  2. amount_zscore: (amount - prior_mean) / prior_std. Fallback 0.0 if history_length < 2.
  3. amount_ratio_mean: amount / prior_mean. Fallback 1.0 if history_length == 0.
  4. hour_deviation: shortest circular distance in hours [0, 12] from customer's prior mean hour. Fallback 0.0.
  5. time_since_last_txn_sec: seconds since immediately previous transaction. Fallback 2592000.0 (30 days).
  6. velocity_1h_count: count of transactions in [t - 1h, t).
  7. velocity_1h_amount: sum of transaction amounts in [t - 1h, t).
  8. velocity_24h_count: count of transactions in [t - 24h, t).
  9. velocity_24h_amount: sum of transaction amounts in [t - 24h, t).
  10. speed_kmh: haversine distance / hours since last transaction, capped at 1500 km/h. Fallback 0.0.
  11. is_new_device: 1.0 if device_key is not null and unseen previously for this customer, else 0.0.
  12. is_new_channel: 1.0 if channel unseen previously for this customer, else 0.0.
  13. device_shared_cust_count: count of distinct customers who used this device strictly before t. Fallback 0.
"""
from __future__ import annotations

from typing import Any, Mapping, Sequence
import numpy as np
import pandas as pd

FEATURE_NAMES: tuple[str, ...] = (
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
    "device_shared_cust_count",
)

REQUIRED_COLUMNS: tuple[str, ...] = (
    "external_customer_id",
    "occurred_at",
    "amount",
    "channel",
    "lat",
    "lon",
)

VALID_CHANNELS: frozenset[str] = frozenset({"pos", "online", "atm"})
COLD_START_TIME_GAP_SEC: float = 2_592_000.0  # 30 days
MAX_SPEED_KMH: float = 1_500.0


class FeatureValidationError(ValueError):
    """Raised when transaction data fails schema or domain validation."""


def haversine_km(lat1: Any, lon1: Any, lat2: Any, lon2: Any) -> Any:
    """Great-circle distance in kilometers using the Haversine formula."""
    p1, p2 = np.radians(lat1), np.radians(lat2)
    dphi = p2 - p1
    dlmb = np.radians(np.asarray(lon2) - np.asarray(lon1))
    a = np.sin(dphi / 2.0) ** 2 + np.cos(p1) * np.cos(p2) * np.sin(dlmb / 2.0) ** 2
    return 2.0 * 6371.0 * np.arcsin(np.sqrt(a))


def validate_transaction_record(txn: Mapping[str, Any]) -> None:
    """Validate a single transaction dictionary or Series before feature extraction."""
    for col in REQUIRED_COLUMNS:
        if col not in txn or txn[col] is None or (isinstance(txn[col], float) and np.isnan(txn[col])):
            raise FeatureValidationError(f"Missing or null required field: '{col}'")

    try:
        amount = float(txn["amount"])
    except (TypeError, ValueError) as err:
        raise FeatureValidationError(f"Invalid amount value: {txn.get('amount')}") from err

    if amount <= 0:
        raise FeatureValidationError(f"Amount must be strictly positive, got {amount}")

    channel = txn["channel"]
    if channel not in VALID_CHANNELS:
        raise FeatureValidationError(
            f"Invalid channel '{channel}'; expected one of {sorted(VALID_CHANNELS)}"
        )

    try:
        lat = float(txn["lat"])
        lon = float(txn["lon"])
    except (TypeError, ValueError) as err:
        raise FeatureValidationError("Coordinates (lat, lon) must be numeric") from err

    if not (-90.0 <= lat <= 90.0) or not (-180.0 <= lon <= 180.0):
        raise FeatureValidationError(f"Coordinates out of bounds: lat={lat}, lon={lon}")


def validate_transactions_dataframe(df: pd.DataFrame) -> None:
    """Validate a transactions DataFrame before batch feature computation."""
    for col in REQUIRED_COLUMNS:
        if col not in df.columns:
            raise FeatureValidationError(f"Missing required column in DataFrame: '{col}'")

    if (df["amount"] <= 0).any():
        raise FeatureValidationError("All amounts must be strictly positive")

    invalid_channels = set(df["channel"].dropna().unique()) - VALID_CHANNELS
    if invalid_channels:
        raise FeatureValidationError(
            f"Invalid channel(s) found: {invalid_channels}; expected {sorted(VALID_CHANNELS)}"
        )

    if not df["lat"].between(-90.0, 90.0).all() or not df["lon"].between(-180.0, 180.0).all():
        raise FeatureValidationError("Latitude must be in [-90, 90] and longitude in [-180, 180]")


def compute_features_batch(df: pd.DataFrame) -> pd.DataFrame:
    """Compute behavioural features for a batch of transactions without lookahead leakage.

    Parameters
    ----------
    df : pd.DataFrame
        Must contain REQUIRED_COLUMNS and optionally 'device_key'.

    Returns
    -------
    pd.DataFrame
        DataFrame with columns matching FEATURE_NAMES and the original index of df.
    """
    if df.empty:
        return pd.DataFrame(columns=list(FEATURE_NAMES), index=df.index, dtype=float)

    validate_transactions_dataframe(df)

    # Work on a copy with datetime occurred_at, preserving original index
    orig_index = df.index
    work = df[["external_customer_id", "occurred_at", "amount", "channel", "lat", "lon"]].copy()
    work["device_key"] = df["device_key"] if "device_key" in df.columns else None

    # Ensure occurred_at is datetime with UTC timezone
    work["occurred_at"] = pd.to_datetime(work["occurred_at"], utc=True)

    # Stable sort by occurred_at to ensure strictly temporal sequencing
    if not work["occurred_at"].is_monotonic_increasing:
        work = work.sort_values("occurred_at", kind="stable")
        sort_order = work.index
    else:
        sort_order = None

    n_rows = len(work)
    cust_ids = work["external_customer_id"].values
    amounts = work["amount"].values.astype(np.float64)
    lats = work["lat"].values.astype(np.float64)
    lons = work["lon"].values.astype(np.float64)
    channels = work["channel"].values
    devices = work["device_key"].values

    # Pre-allocate feature arrays
    feat_history_length = np.zeros(n_rows, dtype=np.float64)
    feat_amount_zscore = np.zeros(n_rows, dtype=np.float64)
    feat_amount_ratio_mean = np.ones(n_rows, dtype=np.float64)
    feat_hour_deviation = np.zeros(n_rows, dtype=np.float64)
    feat_time_since_last = np.full(n_rows, COLD_START_TIME_GAP_SEC, dtype=np.float64)
    feat_vel_1h_count = np.zeros(n_rows, dtype=np.float64)
    feat_vel_1h_amount = np.zeros(n_rows, dtype=np.float64)
    feat_vel_24h_count = np.zeros(n_rows, dtype=np.float64)
    feat_vel_24h_amount = np.zeros(n_rows, dtype=np.float64)
    feat_speed_kmh = np.zeros(n_rows, dtype=np.float64)
    feat_is_new_device = np.zeros(n_rows, dtype=np.float64)
    feat_is_new_channel = np.zeros(n_rows, dtype=np.float64)
    feat_device_shared = np.zeros(n_rows, dtype=np.float64)

    # 1. Device sharing across entire dataset (global, time-ordered)
    seen_cust_per_device: dict[str, set[str]] = {}
    for i in range(n_rows):
        dev = devices[i]
        if dev is not None and not (isinstance(dev, float) and np.isnan(dev)):
            dev_str = str(dev)
            cust_str = str(cust_ids[i])
            s = seen_cust_per_device.get(dev_str)
            if s is None:
                s = set()
                seen_cust_per_device[dev_str] = s
            feat_device_shared[i] = float(len(s))
            s.add(cust_str)
        else:
            feat_device_shared[i] = 0.0

    # 2. Customer-level features
    # Group row indices by customer (order preserved because work is time-sorted)
    cust_groups: dict[str, list[int]] = {}
    for i in range(n_rows):
        c = str(cust_ids[i])
        cust_groups.setdefault(c, []).append(i)

    # Convert times to numeric seconds from epoch for high-speed rolling windows
    epoch_times_sec = pd.to_datetime(work["occurred_at"], utc=True).to_numpy(dtype="datetime64[ms]").astype(np.float64) / 1e3

    # Hour in fractions [0, 24)
    ts_hours = (
        work["occurred_at"].dt.hour.to_numpy(dtype=np.float64)
        + work["occurred_at"].dt.minute.to_numpy(dtype=np.float64) / 60.0
        + work["occurred_at"].dt.second.to_numpy(dtype=np.float64) / 3600.0
    )
    thetas = 2.0 * np.pi * ts_hours / 24.0
    sin_thetas = np.sin(thetas)
    cos_thetas = np.cos(thetas)

    for c_id, idxs_list in cust_groups.items():
        idxs = np.array(idxs_list, dtype=np.int64)
        m = len(idxs)
        if m == 0:
            continue

        c_amounts = amounts[idxs]
        c_times = epoch_times_sec[idxs]
        c_lats = lats[idxs]
        c_lons = lons[idxs]
        c_channels = channels[idxs]
        c_devices = devices[idxs]
        c_sin = sin_thetas[idxs]
        c_cos = cos_thetas[idxs]
        c_hours = ts_hours[idxs]

        # History length (0, 1, 2, ..., m-1)
        k_hist = np.arange(m, dtype=np.float64)
        feat_history_length[idxs] = k_hist

        # Prior amount mean and standard deviation
        prefix_amt = np.pad(np.cumsum(c_amounts), (1, 0))
        prefix_amt_sq = np.pad(np.cumsum(c_amounts ** 2), (1, 0))

        # Sum of strictly prior amounts
        prior_sum = prefix_amt[:-1]
        prior_sum_sq = prefix_amt_sq[:-1]

        # Prior mean: for k_hist > 0, prior_sum / k_hist; else 0.0
        with np.errstate(divide="ignore", invalid="ignore"):
            prior_mean = np.where(k_hist > 0, prior_sum / k_hist, 0.0)
            feat_amount_ratio_mean[idxs] = np.where(k_hist > 0, c_amounts / prior_mean, 1.0)

            # Sample variance: (prior_sum_sq - (prior_sum^2)/k) / (k - 1)
            var_num = prior_sum_sq - (prior_sum ** 2) / np.maximum(k_hist, 1.0)
            sample_var = np.where(k_hist >= 2, var_num / (k_hist - 1.0), 0.0)
            sample_std = np.sqrt(np.maximum(sample_var, 0.0))

            feat_amount_zscore[idxs] = np.where(
                (k_hist >= 2) & (sample_std > 1e-6),
                (c_amounts - prior_mean) / sample_std,
                0.0,
            )

        # Circular mean of prior hours
        prefix_sin = np.pad(np.cumsum(c_sin), (1, 0))
        prefix_cos = np.pad(np.cumsum(c_cos), (1, 0))
        prior_sin = prefix_sin[:-1]
        prior_cos = prefix_cos[:-1]

        with np.errstate(divide="ignore", invalid="ignore"):
            prior_theta = np.arctan2(prior_sin, prior_cos) % (2.0 * np.pi)
            prior_hour_mean = 24.0 * prior_theta / (2.0 * np.pi)
            diff_h = np.abs(c_hours - prior_hour_mean)
            circ_diff_h = np.minimum(diff_h, 24.0 - diff_h)
            feat_hour_deviation[idxs] = np.where(k_hist > 0, circ_diff_h, 0.0)

        # Time since last transaction and speed
        delta_sec = np.empty(m, dtype=np.float64)
        delta_sec[0] = COLD_START_TIME_GAP_SEC
        if m > 1:
            delta_sec[1:] = c_times[1:] - c_times[:-1]
        feat_time_since_last[idxs] = delta_sec

        # Speed (km/h)
        if m > 1:
            d_km = haversine_km(c_lats[:-1], c_lons[:-1], c_lats[1:], c_lons[1:])
            dt_hours = delta_sec[1:] / 3600.0
            with np.errstate(divide="ignore", invalid="ignore"):
                speed = np.where(dt_hours > 0, d_km / dt_hours, 0.0)
                speed_capped = np.clip(speed, 0.0, MAX_SPEED_KMH)
                feat_speed_kmh[idxs[1:]] = speed_capped

        # Velocity in 1h (3600s) and 24h (86400s)
        # Search for window start index in c_times
        idx_1h = np.searchsorted(c_times, c_times - 3600.0, side="left")
        feat_vel_1h_count[idxs] = k_hist - idx_1h
        feat_vel_1h_amount[idxs] = prefix_amt[np.arange(m)] - prefix_amt[idx_1h]

        idx_24h = np.searchsorted(c_times, c_times - 86400.0, side="left")
        feat_vel_24h_count[idxs] = k_hist - idx_24h
        feat_vel_24h_amount[idxs] = prefix_amt[np.arange(m)] - prefix_amt[idx_24h]

        # Is new device for this customer
        seen_cust_devices: set[str] = set()
        c_new_dev = np.zeros(m, dtype=np.float64)
        for j in range(m):
            dev = c_devices[j]
            if dev is not None and not (isinstance(dev, float) and np.isnan(dev)):
                d_str = str(dev)
                if d_str not in seen_cust_devices:
                    c_new_dev[j] = 1.0
                    seen_cust_devices.add(d_str)
                else:
                    c_new_dev[j] = 0.0
            else:
                c_new_dev[j] = 0.0
        feat_is_new_device[idxs] = c_new_dev

        # Is new channel for this customer
        seen_cust_channels: set[str] = set()
        c_new_chan = np.zeros(m, dtype=np.float64)
        for j in range(m):
            ch_str = str(c_channels[j])
            if ch_str not in seen_cust_channels:
                c_new_chan[j] = 1.0
                seen_cust_channels.add(ch_str)
            else:
                c_new_chan[j] = 0.0
        feat_is_new_channel[idxs] = c_new_chan

    out_df = pd.DataFrame(
        {
            "history_length": feat_history_length,
            "amount_zscore": feat_amount_zscore,
            "amount_ratio_mean": feat_amount_ratio_mean,
            "hour_deviation": feat_hour_deviation,
            "time_since_last_txn_sec": feat_time_since_last,
            "velocity_1h_count": feat_vel_1h_count,
            "velocity_1h_amount": feat_vel_1h_amount,
            "velocity_24h_count": feat_vel_24h_count,
            "velocity_24h_amount": feat_vel_24h_amount,
            "speed_kmh": feat_speed_kmh,
            "is_new_device": feat_is_new_device,
            "is_new_channel": feat_is_new_channel,
            "device_shared_cust_count": feat_device_shared,
        },
        index=work.index,
    )

    # Reorder back to original index if work was sorted
    if sort_order is not None:
        out_df = out_df.loc[orig_index]

    return out_df[list(FEATURE_NAMES)]


def compute_features_single(
    current_txn: Mapping[str, Any],
    customer_history: pd.DataFrame | None = None,
    device_history: pd.DataFrame | None = None,
) -> dict[str, float]:
    """Compute behavioural features for a single incoming transaction.

    Parameters
    ----------
    current_txn : Mapping[str, Any]
        Transaction record with REQUIRED_COLUMNS and optional 'device_key'.
    customer_history : pd.DataFrame | None
        Strictly earlier transactions for this customer, sorted by occurred_at.
    device_history : pd.DataFrame | None
        Strictly earlier transactions for this device across all customers.

    Returns
    -------
    dict[str, float]
        Dictionary mapping each feature in FEATURE_NAMES to its computed float value.
    """
    validate_transaction_record(current_txn)

    cur_time = pd.to_datetime(current_txn["occurred_at"], utc=True)
    cur_amount = float(current_txn["amount"])
    cur_channel = str(current_txn["channel"])
    cur_lat = float(current_txn["lat"])
    cur_lon = float(current_txn["lon"])
    raw_dev = current_txn.get("device_key")
    cur_device = None if (raw_dev is None or (isinstance(raw_dev, float) and np.isnan(raw_dev))) else str(raw_dev)

    # Filter customer history to strictly earlier transactions
    if customer_history is not None and not customer_history.empty:
        ch = customer_history.copy()
        ch["occurred_at"] = pd.to_datetime(ch["occurred_at"], utc=True)
        # strictly earlier
        ch = ch[ch["occurred_at"] < cur_time].sort_values("occurred_at", kind="stable")
    else:
        ch = pd.DataFrame()

    k_hist = len(ch)

    # 1. history_length
    f_hist_len = float(k_hist)

    # 2. amount_zscore & 3. amount_ratio_mean
    if k_hist == 0:
        f_zscore = 0.0
        f_ratio = 1.0
    elif k_hist == 1:
        prior_mean = float(ch["amount"].iloc[0])
        f_zscore = 0.0
        f_ratio = (cur_amount / prior_mean) if prior_mean > 0 else 1.0
    else:
        prior_mean = float(ch["amount"].mean())
        prior_std = float(ch["amount"].std(ddof=1))
        f_ratio = (cur_amount / prior_mean) if prior_mean > 0 else 1.0
        if prior_std > 1e-6:
            f_zscore = float((cur_amount - prior_mean) / prior_std)
        else:
            f_zscore = 0.0

    # 4. hour_deviation
    cur_h = cur_time.hour + cur_time.minute / 60.0 + cur_time.second / 3600.0
    if k_hist == 0:
        f_hour_dev = 0.0
    else:
        h_arr = (
            ch["occurred_at"].dt.hour.to_numpy(dtype=np.float64)
            + ch["occurred_at"].dt.minute.to_numpy(dtype=np.float64) / 60.0
            + ch["occurred_at"].dt.second.to_numpy(dtype=np.float64) / 3600.0
        )
        thetas = 2.0 * np.pi * h_arr / 24.0
        mean_theta = np.arctan2(np.sin(thetas).sum(), np.cos(thetas).sum()) % (2.0 * np.pi)
        mean_h = 24.0 * mean_theta / (2.0 * np.pi)
        diff_h = abs(cur_h - mean_h)
        f_hour_dev = float(min(diff_h, 24.0 - diff_h))

    # 5. time_since_last_txn_sec & 10. speed_kmh
    if k_hist == 0:
        f_time_gap = COLD_START_TIME_GAP_SEC
        f_speed = 0.0
    else:
        last_row = ch.iloc[-1]
        dt = (cur_time - pd.Timestamp(last_row["occurred_at"])).total_seconds()
        f_time_gap = float(max(0.0, dt))
        if f_time_gap > 0:
            d_km = float(haversine_km(last_row["lat"], last_row["lon"], cur_lat, cur_lon))
            speed = d_km / (f_time_gap / 3600.0)
            f_speed = float(min(speed, MAX_SPEED_KMH))
        else:
            f_speed = 0.0

    # 6 & 7. Velocity in 1h
    # 8 & 9. Velocity in 24h
    if k_hist == 0:
        f_vel_1h_count = 0.0
        f_vel_1h_amt = 0.0
        f_vel_24h_count = 0.0
        f_vel_24h_amt = 0.0
    else:
        t_1h_cut = cur_time - pd.Timedelta(hours=1)
        t_24h_cut = cur_time - pd.Timedelta(hours=24)

        w1 = ch[ch["occurred_at"] >= t_1h_cut]
        f_vel_1h_count = float(len(w1))
        f_vel_1h_amt = float(w1["amount"].sum())

        w24 = ch[ch["occurred_at"] >= t_24h_cut]
        f_vel_24h_count = float(len(w24))
        f_vel_24h_amt = float(w24["amount"].sum())

    # 11. is_new_device
    if cur_device is None:
        f_is_new_dev = 0.0
    else:
        if k_hist == 0:
            f_is_new_dev = 1.0
        else:
            seen_devs = set(ch["device_key"].dropna().astype(str).unique())
            f_is_new_dev = 1.0 if cur_device not in seen_devs else 0.0

    # 12. is_new_channel
    if k_hist == 0:
        f_is_new_chan = 1.0
    else:
        seen_chans = set(ch["channel"].dropna().astype(str).unique())
        f_is_new_chan = 1.0 if cur_channel not in seen_chans else 0.0

    # 13. device_shared_cust_count
    if cur_device is None:
        f_dev_shared = 0.0
    elif device_history is not None and not device_history.empty:
        dh = device_history.copy()
        dh["occurred_at"] = pd.to_datetime(dh["occurred_at"], utc=True)
        # strictly earlier transactions with this device
        dh_prior = dh[(dh["occurred_at"] < cur_time) & (dh["device_key"] == cur_device)]
        f_dev_shared = float(dh_prior["external_customer_id"].nunique())
    else:
        f_dev_shared = 0.0

    features = {
        "history_length": f_hist_len,
        "amount_zscore": f_zscore,
        "amount_ratio_mean": f_ratio,
        "hour_deviation": f_hour_dev,
        "time_since_last_txn_sec": f_time_gap,
        "velocity_1h_count": f_vel_1h_count,
        "velocity_1h_amount": f_vel_1h_amt,
        "velocity_24h_count": f_vel_24h_count,
        "velocity_24h_amount": f_vel_24h_amt,
        "speed_kmh": f_speed,
        "is_new_device": f_is_new_dev,
        "is_new_channel": f_is_new_chan,
        "device_shared_cust_count": f_dev_shared,
    }

    return {k: features[k] for k in FEATURE_NAMES}
