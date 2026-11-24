import os
from pathlib import Path

# Paths
BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "surveillance.db"
DATASETS_DIR = BASE_DIR / "datasets"
MODELS_DIR = BASE_DIR / "models"
UPLOAD_DIR = BASE_DIR / "uploads"

# Create directories if they don't exist
for directory in [DATASETS_DIR, MODELS_DIR, UPLOAD_DIR]:
    directory.mkdir(parents=True, exist_ok=True)

class Config:
    # Flask settings
    SECRET_KEY = os.environ.get("SECRET_KEY", "super-secret-key-12345")
    DEBUG = True
    
    # Database
    SQLALCHEMY_DATABASE_URI = os.environ.get("DATABASE_URL", f"sqlite:///{DB_PATH}")
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    # Directory paths
    DATASETS_DIR = str(DATASETS_DIR)
    MODELS_DIR = str(MODELS_DIR)
    UPLOAD_DIR = str(UPLOAD_DIR)
    
    # Biometric thresholds
    FACE_SIMILARITY_THRESHOLD = float(os.environ.get("FACE_SIMILARITY_THRESHOLD", 0.65)) # Cosine similarity
    GAIT_CONFIDENCE_THRESHOLD = float(os.environ.get("GAIT_CONFIDENCE_THRESHOLD", 0.60)) # SVM/RF Probabilities
    
    # CCTV Inference setting
    DEFAULT_CAMERA_SRC = 0 # Default web camera index or path to demo video if webcam unavailable
