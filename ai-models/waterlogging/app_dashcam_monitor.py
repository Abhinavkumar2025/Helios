import os
import glob
import json
import streamlit as st
import pandas as pd
import pydeck as pdk
from PIL import Image

# ----------------- PAGE CONFIGURATION -----------------
st.set_page_config(
    page_title="Municipal Smart Waterlog Operations",
    page_icon="🌊",
    layout="wide",
    initial_sidebar_state="expanded"
)

# ----------------- DIRECTORY PATHS -----------------
DIR_GLOBAL_BEST = "dashcam_global_best_incident"
DIR_PATCH_BEST  = "dashcam_clean_outputs"
DIR_TELEMETRY   = "dashcam_telemetry_dedup"

# ----------------- DATA LOADERS -----------------
def load_global_best():
    meta_path = os.path.join(DIR_GLOBAL_BEST, "global_best_meta.json")
    if os.path.exists(meta_path):
        try:
            with open(meta_path, "r") as f:
                data = json.load(f)
            img_path = os.path.join(DIR_GLOBAL_BEST, data["frame"])
            if os.path.exists(img_path):
                return data, img_path
        except Exception:
            pass
    return None, None

def load_patch_telemetry():
    records = []
    for j_file in glob.glob(os.path.join(DIR_TELEMETRY, "*.json")):
        try:
            with open(j_file, "r") as f:
                rec = json.load(f)
                img_file = os.path.join(DIR_PATCH_BEST, rec["frame"])
                records.append({
                    "incident_id": rec.get("incident_id", "N/A"),
                    "lat": rec["gps"]["lat"],
                    "lon": rec["gps"]["lon"],
                    "severity": rec["classification"]["severity"],
                    "conf": rec["metrics"]["mean_confidence"],
                    "w_score": rec["metrics"]["water_hazard_score"],
                    "coverage": rec["metrics"]["road_water_coverage_pct"],
                    "avg_score": rec["metrics"].get("selection_avg_score", 0.0),
                    "timestamp": rec.get("timestamp", "N/A"),
                    "img_path": img_file if os.path.exists(img_file) else None
                })
        except Exception:
            continue
    return pd.DataFrame(records)

# ----------------- UI HEADER -----------------
st.title("🌊 Municipal Waterlogging Incident Command Center")
st.caption("AI Dashcam Vision Feed | 10m Spatial Deduplication | High-Confidence Incident Extraction")

# ----------------- GLOBAL BEST INCIDENT SPOTLIGHT -----------------
global_meta, global_img_path = load_global_best()

st.markdown("### 🏆 Highest Priority Flood Zone (Session Winner)")

if global_meta and global_img_path:
    col_img, col_metrics = st.columns([1.2, 1.0])

    with col_img:
        img = Image.open(global_img_path)
        st.image(img, caption=f"Representative Frame: {global_meta['frame']}", use_container_width=True)

    with col_metrics:
        st.error(f"🚨 Level: {global_meta['severity']} HAZARD")
        
        m_col1, m_col2 = st.columns(2)
        m_col1.metric("Composite Avg Score", f"{global_meta['avg_score']:.2f}")
        m_col2.metric("Detection Confidence", f"{global_meta['conf'] * 100:.1f}%")

        m_col3, m_col4 = st.columns(2)
        m_col3.metric("Hazard Score ($W_{score}$)", f"{global_meta['score']:.2f}")
        m_col4.metric("Road Water Coverage", f"{global_meta['coverage']:.1f}%")

        st.info(f"📍 **Coordinates:** {global_meta['lat']:.6f}, {global_meta['lon']:.6f}")
        st.write("This frame was selected by evaluating continuous waterlogged regions and retaining only the snapshot with the highest combined confidence and road hazard index.")
else:
    st.info("No waterlogging incident detected yet. Run `run_smart_dedup_pipeline.py` to populate data.")

st.markdown("---")

# ----------------- INCIDENT MAP & TELEMETRY -----------------
df = load_patch_telemetry()

st.subheader("🗺️ Deduplicated Incident Registry (10-Meter Zones)")

if not df.empty:
    def get_color(sev):
        if sev == "CRITICAL":
            return [230, 0, 0, 200]
        elif sev == "MODERATE":
            return [255, 140, 0, 180]
        elif sev == "LOW":
            return [255, 215, 0, 160]
        return [0, 200, 0, 140]

    df["color"] = df["severity"].apply(get_color)

    # 3D PyDeck Map
    view_state = pdk.ViewState(
        latitude=df["lat"].mean(),
        longitude=df["lon"].mean(),
        zoom=15,
        pitch=45
    )

    layer = pdk.Layer(
        "ScatterplotLayer",
        df,
        get_position=["lon", "lat"],
        get_color="color",
        get_radius=8,
        pickable=True,
        auto_highlight=True
    )

    deck = pdk.Deck(
        layers=[layer],
        initial_view_state=view_state,
        tooltip={
            "html": "<b>Incident:</b> {incident_id}<br/>"
                    "<b>Severity:</b> {severity}<br/>"
                    "<b>Avg Rank Score:</b> {avg_score}<br/>"
                    "<b>Coverage:</b> {coverage}%",
            "style": {"backgroundColor": "#1e1e1e", "color": "#ffffff"}
        }
    )

    st.pydeck_chart(deck)

    # Table breakdown of deduplicated incidents
    st.markdown("#### Logged Distinct Patches")
    st.dataframe(
        df[["incident_id", "severity", "avg_score", "conf", "w_score", "coverage", "lat", "lon", "timestamp"]],
        use_container_width=True
    )

else:
    st.write("Waiting for incident telemetry...")