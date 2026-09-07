# pyrefly: ignore [missing-import]
from roboflow import Roboflow

# Yahan apni Roboflow API key paste karna
API_KEY = "YOUR_ROBOFLOW_API_KEY"

rf = Roboflow(api_key="BF7ezb2DUvCW9wRei5lR")

print("[1/2] Downloading Dataset 1 (try-0tjxt)...")
p1 = rf.workspace("try-0tjxt").project("water-logging-h74an")
p1.version(1).download("yolov11", location="datasets/raw_try")

print("[2/2] Downloading Dataset 2 (henrys-workspace-ds68i)...")
p2 = rf.workspace("henrys-workspace-ds68i").project("waterlogging-1hcfe")
p2.version(1).download("yolov11", location="datasets/raw_henry")

print("[SUCCESS] Roboflow datasets download complete!")
