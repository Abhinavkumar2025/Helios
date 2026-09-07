import os
import asyncio
import requests
import exifread

def _get_ip_location():
    """Secondary network fallback if Windows location service is unavailable."""
    try:
        resp = requests.get("https://ipapi.co/json/", timeout=3).json()
        lon_val = round(resp.get("longitude", 72.8777), 6)
        return {
            "lat": round(resp.get("latitude", 19.0760), 6),
            "lng": lon_val,
            "lon": lon_val,
            "source": "Laptop_IP_Network"
        }
    except Exception:
        return {"lat": 19.0760, "lng": 72.8777, "lon": 72.8777, "source": "Default_Fallback"}

async def _get_windows_native_location():
    """Queries Windows 10/11 native location service."""
    from winsdk.windows.devices.geolocation import Geolocator, GeolocationAccessStatus
    
    access = await Geolocator.request_access_async()
    if access != GeolocationAccessStatus.ALLOWED:
        return None
    
    geolocator = Geolocator()
    pos = await geolocator.get_geoposition_async()
    coord = pos.coordinate.point.position
    lon_val = round(coord.longitude, 6)
    return {
        "lat": round(coord.latitude, 6),
        "lng": lon_val,
        "lon": lon_val,
        "source": "Laptop_Windows_GPS"
    }

def get_laptop_gps():
    """Fetches laptop coordinates via Windows Location API or IP fallback."""
    try:
        loc = asyncio.run(_get_windows_native_location())
        if loc:
            return loc
    except Exception:
        pass
    return _get_ip_location()

def extract_exif_gps(image_path):
    """Extracts embedded GPS coordinates from image EXIF metadata."""
    try:
        with open(image_path, "rb") as f:
            tags = exifread.process_file(f, details=False)

        def _to_degrees(val):
            d = float(val.values[0].num) / float(val.values[0].den)
            m = float(val.values[1].num) / float(val.values[1].den)
            s = float(val.values[2].num) / float(val.values[2].den)
            return d + (m / 60.0) + (s / 3600.0)

        lat = _to_degrees(tags["GPS GPSLatitude"])
        lon = _to_degrees(tags["GPS GPSLongitude"])
        if tags["GPS GPSLatitudeRef"].values == "S":
            lat = -lat
        if tags["GPS GPSLongitudeRef"].values == "W":
            lon = -lon
        lon_val = round(lon, 6)
        return {
            "lat": round(lat, 6),
            "lng": lon_val,
            "lon": lon_val,
            "source": "Image_EXIF_GPS"
        }
    except Exception:
        return None

def resolve_gps_coordinates(image_path, explicit_gps=None, index_jitter=0):
    """
    Priority Hierarchy:
    1. Explicitly supplied GPS (e.g. from API/Companion app)
    2. Embedded photo EXIF GPS
    3. Laptop current GPS (with slight indexing jitter across frames for fleet spread)
    """
    # 1. Explicit GPS provided
    if explicit_gps and "lat" in explicit_gps and ("lng" in explicit_gps or "lon" in explicit_gps):
        lon_val = explicit_gps.get("lng", explicit_gps.get("lon"))
        return {
            "lat": explicit_gps["lat"],
            "lng": lon_val,
            "lon": lon_val,
            "source": explicit_gps.get("source", "Explicit_Payload")
        }

    # 2. Embedded EXIF tags inside the photo
    exif_coords = extract_exif_gps(image_path)
    if exif_coords:
        return exif_coords

    # 3. Fallback: Laptop live GPS
    laptop_loc = get_laptop_gps()
    jitter_lat = index_jitter * 0.0012
    jitter_lon = index_jitter * 0.0010
    lon_val = round(laptop_loc.get("lng", laptop_loc.get("lon", 72.8777)) + jitter_lon, 6)
    return {
        "lat": round(laptop_loc["lat"] + jitter_lat, 6),
        "lng": lon_val,
        "lon": lon_val,
        "source": laptop_loc["source"]
    }