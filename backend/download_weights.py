import os
import requests
from pathlib import Path

# Base paths
BASE_DIR = Path(__file__).resolve().parent
MODELS_DIR = BASE_DIR / "models"
MODELS_DIR.mkdir(parents=True, exist_ok=True)

YUNET_PATH = MODELS_DIR / "face_detection_yunet_2023mar.onnx"
SFACE_PATH = MODELS_DIR / "face_recognition_sface_2021dec.onnx"
POSE_PATH = MODELS_DIR / "pose_landmarker_full.task"

YUNET_URL = "https://github.com/opencv/opencv_zoo/raw/main/models/face_detection_yunet/face_detection_yunet_2023mar.onnx"
SFACE_URL = "https://github.com/opencv/opencv_zoo/raw/main/models/face_recognition_sface/face_recognition_sface_2021dec.onnx"
POSE_URL = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/latest/pose_landmarker_full.task"

def download_file(url, dest_path):
    print(f"Downloading {url} to {dest_path}...")
    try:
        response = requests.get(url, stream=True, timeout=30)
        response.raise_for_status()
        with open(dest_path, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                if chunk:
                    f.write(chunk)
        print(f"Successfully downloaded {dest_path}")
        return True
    except Exception as e:
        print(f"Failed to download {url}: {e}")
        return False

def setup_models():
    # Download YuNet if missing
    if not YUNET_PATH.exists():
        success = download_file(YUNET_URL, YUNET_PATH)
        if not success:
            alt_url = "https://github.com/opencv/opencv_zoo/raw/master/models/face_detection_yunet/face_detection_yunet_2023mar.onnx"
            download_file(alt_url, YUNET_PATH)
            
    # Download SFace if missing
    if not SFACE_PATH.exists():
        success = download_file(SFACE_URL, SFACE_PATH)
        if not success:
            alt_url = "https://github.com/opencv/opencv_zoo/raw/master/models/face_recognition_sface/face_recognition_sface_2021dec.onnx"
            download_file(alt_url, SFACE_PATH)

    # Download MediaPipe Pose landmarker if missing
    if not POSE_PATH.exists():
        download_file(POSE_URL, POSE_PATH)


if __name__ == "__main__":
    setup_models()
