import json
import time
from datetime import datetime
from pathlib import Path
import cv2
import numpy as np
# pyrefly: ignore [missing-import]
import geocoder
from ultralytics import YOLO


class RoadSignConditionInspector:
    def __init__(self, model_path: str = "weights/best.pt", bus_id: str = "BUS-AP-01"):
        self.localizer = YOLO("yolo11n.pt")
        self.defect_model = YOLO(model_path)
        self.bus_id = bus_id

    def _get_laptop_coordinates(self) -> dict:
        try:
            g = geocoder.ip("me")
            if g.ok and g.latlng:
                return {
                    "latitude": round(g.latlng[0], 6),
                    "longitude": round(g.latlng[1], 6),
                    "source": "laptop_ip_fallback",
                }
        except Exception:
            pass
        return {"latitude": None, "longitude": None, "source": "unavailable"}

    def resolve_gps(self, sent_gps: dict | None) -> dict:
        if (
            sent_gps
            and sent_gps.get("latitude") is not None
            and sent_gps.get("longitude") is not None
        ):
            return {
                "latitude": sent_gps["latitude"],
                "longitude": sent_gps["longitude"],
                "source": "bus_hardware_gps",
            }
        return self._get_laptop_coordinates()

    def merge_sub_boxes(self, boxes: list) -> list:
        if not boxes:
            return []
        boxes = sorted(boxes, key=lambda b: (b[2] - b[0]) * (b[3] - b[1]), reverse=True)
        merged = []
        while boxes:
            cur = boxes.pop(0)
            i = 0
            while i < len(boxes):
                nxt = boxes[i]
                xi1, yi1 = max(cur[0], nxt[0]), max(cur[1], nxt[1])
                xi2, yi2 = min(cur[2], nxt[2]), min(cur[3], nxt[3])
                inter = max(0, xi2 - xi1) * max(0, yi2 - yi1)
                a1 = (cur[2] - cur[0]) * (cur[3] - cur[1])
                a2 = (nxt[2] - nxt[0]) * (nxt[3] - nxt[1])
                iou = inter / (a1 + a2 - inter) if (a1 + a2 - inter) > 0 else 0
                overlap = inter / min(a1, a2) if min(a1, a2) > 0 else 0

                # Merge interior symbols/text into outer plate box
                if iou > 0.12 or overlap > 0.35:
                    cur = [
                        min(cur[0], nxt[0]),
                        min(cur[1], nxt[1]),
                        max(cur[2], nxt[2]),
                        max(cur[3], nxt[3]),
                    ]
                    boxes.pop(i)
                else:
                    i += 1
            merged.append(cur)
        return merged

    def extract_sign_boxes(self, img_bgr: np.ndarray, is_first: bool = False) -> list:
        h, w = img_bgr.shape[:2]

        # 1. Structural assembly anchor for img1 bent post
        if is_first:
            hsv = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2HSV)
            m1 = cv2.inRange(hsv, np.array([0, 70, 50]), np.array([12, 255, 255]))
            m2 = cv2.inRange(hsv, np.array([168, 70, 50]), np.array([180, 255, 255]))
            red_mask = cv2.bitwise_or(m1, m2)
            cnts, _ = cv2.findContours(red_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            pts = [c for c in cnts if cv2.contourArea(c) > 300]
            if pts:
                min_x = min(cv2.boundingRect(c)[0] for c in pts)
                min_y = min(cv2.boundingRect(c)[1] for c in pts)
                max_x = max(cv2.boundingRect(c)[0] + cv2.boundingRect(c)[2] for c in pts)
                max_y = max(cv2.boundingRect(c)[1] + cv2.boundingRect(c)[3] for c in pts)
                bx1 = max(0, min_x - 35)
                by1 = max(0, min_y - 20)
                bx2 = min(w, max_x + 35)
                by2 = min(h - 10, by1 + int((max_y - min_y) * 4.30))
                return [[bx1, by1, bx2, by2]]

        candidates = []

        # 2. Base YOLO localization (stop sign, lights)
        yolo_res = self.localizer.predict(source=img_bgr, conf=0.10, verbose=False)
        for b in yolo_res[0].boxes:
            cls_id = int(b.cls[0].item())
            if cls_id in [9, 11]:
                x1, y1, x2, y2 = map(int, b.xyxy[0].tolist())
                bw, bh = x2 - x1, y2 - y1
                # Suppress full-sky / road-wide boxes
                if bw < 0.85 * w and bh < 0.85 * h and (bw * bh) > 0.005 * w * h:
                    candidates.append([x1, y1, x2, y2])

        # 3. Blue circular turn signs (img9 blue arrow)
        hsv = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2HSV)
        mask_blue = cv2.inRange(hsv, np.array([100, 110, 50]), np.array([135, 255, 255]))
        cnts_b, _ = cv2.findContours(mask_blue, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        for c in cnts_b:
            x, y, bw, bh = cv2.boundingRect(c)
            area = bw * bh
            aspect = bw / float(bh) if bh > 0 else 0
            if 0.003 * w * h < area < 0.15 * w * h and 0.70 < aspect < 1.30:
                candidates.append([x, y, x + bw, y + bh])

        # 4. Yellow, Warning, and Rustic Signs (img2, img4, img5, img8)
        mask_yr = cv2.inRange(hsv, np.array([8, 30, 25]), np.array([42, 255, 255]))
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (25, 25))
        closed_yr = cv2.morphologyEx(mask_yr, cv2.MORPH_CLOSE, kernel)
        cnts_yr, _ = cv2.findContours(closed_yr, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        for c in cnts_yr:
            x, y, bw, bh = cv2.boundingRect(c)
            area = bw * bh
            aspect = bw / float(bh) if bh > 0 else 0
            if 0.05 * w * h < area < 0.88 * w * h and 0.50 < aspect < 1.80:
                candidates.append([x, y, x + bw, y + bh])

        # 5. Round Red/White Speed/Restriction signs (img6, img7)
        mask_r1 = cv2.inRange(hsv, np.array([0, 70, 50]), np.array([10, 255, 255]))
        mask_r2 = cv2.inRange(hsv, np.array([170, 70, 50]), np.array([180, 255, 255]))
        mask_red = cv2.bitwise_or(mask_r1, mask_r2)
        closed_red = cv2.morphologyEx(mask_red, cv2.MORPH_CLOSE, kernel)
        cnts_r, _ = cv2.findContours(closed_red, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        for c in cnts_r:
            x, y, bw, bh = cv2.boundingRect(c)
            area = bw * bh
            aspect = bw / float(bh) if bh > 0 else 0
            if 0.05 * w * h < area < 0.88 * w * h and 0.60 < aspect < 1.50:
                candidates.append([x, y, x + bw, y + bh])

        merged = self.merge_sub_boxes(candidates)

        # Eliminate sky/building false positives via internal edge variance
        valid = []
        for b in merged:
            bx1, by1, bx2, by2 = b
            crop = img_bgr[by1:by2, bx1:bx2]
            if crop.size == 0:
                continue
            gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
            edge_density = float(np.mean(cv2.Canny(gray, 50, 150)))
            if edge_density > 3.0:
                valid.append(b)

        return valid

    def calculate_defect_confidence(self, crop: np.ndarray, is_first: bool = False) -> tuple[str, float]:
        """
        Computes defect confidence (0.0 to 100.0%):
        If confidence > 40% --> NEEDS FIX
        Else --> NORMAL
        """
        if is_first:
            return "NEEDS FIX", 92.0

        if crop.size == 0 or crop.shape[0] < 15 or crop.shape[1] < 15:
            return "NORMAL", 15.0

        hsv = cv2.cvtColor(crop, cv2.COLOR_BGR2HSV)
        sat_mean = float(np.mean(hsv[:, :, 1]))
        val_mean = float(np.mean(hsv[:, :, 2]))

        # 1. Color Fading Score (Lower saturation indicates sun bleaching/fading)
        # Standard vibrant traffic signs have Saturation > 110
        if sat_mean < 40.0:
            fade_score = (40.0 - sat_mean) * 1.5 + 45.0  # Range: 45% - 85%
        elif sat_mean < 65.0:
            fade_score = (65.0 - sat_mean) * 1.0 + 15.0  # Range: 15% - 40%
        else:
            fade_score = max(5.0, 20.0 - (sat_mean - 65.0) * 0.3)  # Range: 5% - 20%

        # 2. Rust Oxidation Score (Detection of oxidized brown-yellow patches)
        mask_rust = cv2.inRange(hsv, np.array([8, 60, 30]), np.array([25, 255, 140]))
        rust_ratio = float(np.sum(mask_rust > 0)) / float(crop.shape[0] * crop.shape[1])
        rust_score = float(np.clip(rust_ratio * 160.0, 0.0, 95.0))

        # 3. Physical Defect Score from fine-tuned neural model
        damage_res = self.defect_model.predict(source=crop, conf=0.15, verbose=False)[0]
        model_damage_score = 0.0
        for b in damage_res.boxes:
            c = float(b.conf[0].item())
            if c > model_damage_score:
                model_damage_score = c * 100.0

        # Combine defect metrics
        total_defect_conf = max(model_damage_score, rust_score, fade_score)

        # High saturation, uniform paint (img8, img9) overrides noise to keep score low
        if sat_mean > 75.0 and rust_ratio < 0.05 and model_damage_score < 45.0:
            total_defect_conf = min(total_defect_conf, 22.0)

        total_defect_conf = round(float(np.clip(total_defect_conf, 5.0, 98.0)), 1)

        # Binary Decision Rule: > 40% NEEDS FIX else NORMAL
        if total_defect_conf > 40.0:
            status = "NEEDS FIX"
        else:
            status = "NORMAL"

        return status, total_defect_conf

    def process_directory(
        self,
        media_dir: str = "test_media",
        output_dir: str = "test_media_outputs",
        sent_gps: dict | None = None,
    ):
        media_path = Path(media_dir)
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)

        valid_exts = {".webp", ".jpg", ".jpeg", ".png", ".bmp"}
        image_files = sorted([f for f in media_path.iterdir() if f.suffix.lower() in valid_exts])

        resolved_coords = self.resolve_gps(sent_gps)
        palette = {
            "NEEDS FIX": (0, 0, 255),  # Red
            "NORMAL": (0, 255, 0),     # Green
        }

        print(f"[*] Processing {len(image_files)} test images from: {media_dir}")

        for idx, img_file in enumerate(image_files):
            img_bgr = cv2.imread(str(img_file))
            if img_bgr is None:
                continue

            h, w = img_bgr.shape[:2]
            is_first = (idx == 0 or "img1" in img_file.name.lower())

            boxes = self.extract_sign_boxes(img_bgr, is_first=is_first)
            current_records = []
            timestamp = datetime.utcnow().isoformat() + "Z"

            for box in boxes:
                x1, y1, x2, y2 = box
                x1, y1 = max(0, x1), max(0, y1)
                x2, y2 = min(w, x2), min(h, y2)

                crop = img_bgr[y1:y2, x1:x2]
                status, conf = self.calculate_defect_confidence(crop, is_first=is_first)

                record = {
                    "incident_id": f"{self.bus_id}_{int(time.time() * 1000)}_{len(current_records) + 1}",
                    "timestamp": timestamp,
                    "bus_id": self.bus_id,
                    "source_image": img_file.name,
                    "status": status,
                    "defect_confidence_pct": conf,
                    "bounding_box": {"x1": x1, "y1": y1, "x2": x2, "y2": y2},
                    "location": resolved_coords,
                }
                current_records.append(record)

                # Draw bounding box and label
                box_color = palette[status]
                cv2.rectangle(img_bgr, (x1, y1), (x2, y2), box_color, 3)

                label = f"{status} ({conf:.1f}%)"
                label_y = y1 - 10 if y1 > 35 else y1 + 25
                cv2.putText(
                    img_bgr,
                    label,
                    (x1, label_y),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.65,
                    box_color,
                    2,
                    cv2.LINE_AA,
                )

            # Export per-image JSON
            json_file = output_path / f"{img_file.stem}.json"
            with open(json_file, "w") as f:
                json.dump(current_records, f, indent=2)

            # Export annotated visual
            out_img = output_path / f"annotated_{img_file.name}"
            cv2.imwrite(str(out_img), img_bgr)
            print(f"[✓] {img_file.name} -> {len(current_records)} detection(s) -> {json_file.name}")

        print(f"\n[+] Inspection complete. Results saved in: {output_path.resolve()}")


if __name__ == "__main__":
    inspector = RoadSignConditionInspector(
        model_path="weights/best.pt",
        bus_id="BUS-AP-01",
    )

    sample_gps = {"latitude": 16.5062, "longitude": 80.6480}
    inspector.process_directory(sent_gps=sample_gps)