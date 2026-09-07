import os

CONFIG = {
    # Model Weights
    "base_weights": "yolo11n-seg.pt",
    "custom_weights": os.path.join("weights", "waterlog_best.pt"),
    "data_yaml": os.path.join("datasets", "unified_waterlog", "data.yaml"),

    # Detection & Dual-Hazard Rules
    "min_conf": 0.70,                  # Strict 70% confidence cutoff
    "single_hazard_area_pct": 20.0,    # Condition 1: Single puddle >= 20% road area
    "cluster_count_thresh": 3,         # Condition 2: >= 3 puddles
    "cluster_total_area_pct": 15.0,    # Condition 2: Combined puddle coverage >= 15%

    # Temporal Filter & Debounce
    "temporal_window": 3,              # 3 frames buffer
    "min_temporal_hits": 2,            # 3 me se 2 baar confirm hona chahiye
    "alert_cooldown_sec": 5.0,         # Alert repeat delay

    # Edge Telemetry Metadata
    "device_id": "EDGE-BUS-01",
    "default_gps": {"lat": 16.5062, "lng": 80.6480, "lon": 80.6480}
}
