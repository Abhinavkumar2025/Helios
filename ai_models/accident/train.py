import os
from pathlib import Path
import torch
from ultralytics import YOLO

def train():
    script_dir = Path(__file__).parent.resolve()
    data_yaml = script_dir / "data.yaml"
    # User specified output weights should land at runs/accident/*/weights/best.pt
    # In Helios root or ai_models/accident
    helios_root = script_dir.parent.parent.resolve()
    project_dir = helios_root / "runs" / "accident"
    
    device = 0 if torch.cuda.is_available() else "cpu"
    print(f"[HELIOS] Training YOLOv8n Accident Detector on device: {device}")
    if torch.cuda.is_available():
        print(f"[HELIOS] GPU Detected: {torch.cuda.get_device_name(0)}")
    
    # Use plain yolov8n.pt (bounding box object detection)
    model = YOLO("yolov8n.pt")
    
    # Train: 80 epochs, imgsz 640, batch 16, patience 15
    results = model.train(
        data=str(data_yaml),
        epochs=80,
        imgsz=640,
        batch=16,
        patience=15,
        project=str(project_dir),
        name="exp",
        device=device,
        exist_ok=True,
        plots=True,
        verbose=True,
    )
    
    print("[HELIOS] Training completed. Running validation...")
    val_metrics = model.val(data=str(data_yaml), split="val")
    
    # Report metrics: mAP50, precision, recall
    map50 = val_metrics.box.map50
    precision = val_metrics.box.mp
    recall = val_metrics.box.mr
    map50_95 = val_metrics.box.map
    
    print("=" * 60)
    print("HELIOS ACCIDENT DETECTOR VALIDATION METRICS:")
    print(f"  Precision: {precision:.4f}")
    print(f"  Recall:    {recall:.4f}  <-- Priority metric (minimizing false negatives)")
    print(f"  mAP50:     {map50:.4f}")
    print(f"  mAP50-95:  {map50_95:.4f}")
    print("=" * 60)
    
    best_weights = project_dir / "exp" / "weights" / "best.pt"
    print(f"[HELIOS] Best weights saved to: {best_weights}")
    return results, val_metrics

if __name__ == "__main__":
    train()
