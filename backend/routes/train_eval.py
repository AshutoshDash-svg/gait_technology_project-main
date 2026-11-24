import os
import joblib
from flask import Blueprint, jsonify, current_app
from pathlib import Path
from config import Config
from training.train_gait import train_and_evaluate_gait

train_eval_bp = Blueprint('train_eval', __name__)

@train_eval_bp.route('/api/train/gait', methods=['POST'])
def train_gait_model():
    """Triggers the training center gait pipelines. Fits SVM & Random Forest classifiers."""
    try:
        results = train_and_evaluate_gait(current_app)
        
        if not results.get("success"):
            return jsonify({"success": False, "error": results.get("error")}), 400
            
        # Refresh gait model in active detection service
        detection_svc = getattr(current_app, 'detection_service', None)
        if detection_svc:
            detection_svc.gait_service.load_model()
            
        return jsonify({
            "success": True,
            "message": "Gait recognition model trained and saved successfully.",
            "data": results.get("metadata")
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@train_eval_bp.route('/api/models', methods=['GET'])
def get_models_status():
    """Returns the initialization and accuracy metrics status of Face and Gait models."""
    model_dir = Path(Config.MODELS_DIR)
    metadata_path = model_dir / "model_metadata.joblib"
    
    # 1. Face Model
    # Both YuNet & SFace are loaded on startup. Ready status depends on weights existence.
    yunet_exist = (model_dir / "face_detection_yunet_2023mar.onnx").exists()
    sface_exist = (model_dir / "face_recognition_sface_2021dec.onnx").exists()
    
    face_status = {
        "name": "SFace / YuNet",
        "type": "Face Detection & Alignment Embeddings",
        "status": "READY" if (yunet_exist and sface_exist) else "MISSING_WEIGHTS",
        "version": "1.0.0" if sface_exist else "N/A",
        "details": "128-D Cosine Face Recognition system" if sface_exist else "Run download_weights.py"
    }
    
    # 2. Gait Model
    gait_status = {
        "name": "SVM / Random Forest Classifier",
        "type": "Body Pose walking dynamics classifier",
        "status": "NOT TRAINED",
        "version": "N/A",
        "training_date": None,
        "best_algorithm": None,
        "metrics": None,
        "dataset_counts": None,
        "confusion_matrix": None
    }
    
    if metadata_path.exists():
        try:
            meta = joblib.load(metadata_path)
            gait_status.update({
                "status": "TRAINED",
                "version": meta.get("model_version", "1.0.0"),
                "training_date": meta.get("training_date"),
                "best_algorithm": meta.get("best_algorithm"),
                "metrics": meta.get("metrics"),
                "dataset_counts": meta.get("dataset_counts"),
                "confusion_matrix": meta.get("confusion_matrix")
            })
        except Exception as e:
            print(f"Error loading gait metadata: {e}")
            gait_status["status"] = "ERROR_LOADING"
            
    return jsonify({
        "success": True,
        "data": {
            "face_model": face_status,
            "gait_model": gait_status
        }
    })

@train_eval_bp.route('/api/evaluate/gait', methods=['GET'])
def evaluate_gait():
    """Retrieve detailed validation report of the gait classifier if it exists."""
    metadata_path = Path(Config.MODELS_DIR) / "model_metadata.joblib"
    if not metadata_path.exists():
        return jsonify({"success": False, "error": "Model has not been trained yet. Evaluation metrics are unavailable."}), 400
        
    try:
        meta = joblib.load(metadata_path)
        return jsonify({
            "success": True,
            "data": meta
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500
