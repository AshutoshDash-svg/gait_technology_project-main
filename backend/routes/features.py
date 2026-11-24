import os
import cv2
import numpy as np
from flask import Blueprint, jsonify, current_app
from pathlib import Path
from database.db import db
from database.models import Person, FaceSample, GaitVideo, GaitFeature
from config import Config

features_bp = Blueprint('features', __name__)

@features_bp.route('/api/features/extract-face', methods=['POST'])
def extract_face_features():
    """Triggers face embedding extraction for all face images that have not been processed yet."""
    detection_svc = getattr(current_app, 'detection_service', None)
    if not detection_svc:
        return jsonify({"success": False, "error": "Detection service not initialized"}), 500
        
    face_svc = detection_svc.face_service
    
    # Query all unprocessed face samples
    unprocessed = FaceSample.query.filter(
        (FaceSample.embedding_path == None) | (~FaceSample.is_aligned)
    ).all()
    
    if not unprocessed:
        return jsonify({"success": True, "message": "All face images already have features extracted.", "count": 0})
        
    success_count = 0
    failure_count = 0
    
    for sample in unprocessed:
        if not os.path.exists(sample.file_path):
            failure_count += 1
            continue
            
        try:
            # Read image using OpenCV
            img = cv2.imread(sample.file_path)
            if img is None:
                failure_count += 1
                continue
                
            # Detect face
            faces = face_svc.detect_faces(img)
            if not faces:
                failure_count += 1
                continue
                
            # Select the main face (largest)
            face_meta = max(faces, key=lambda f: f["box"][2] * f["box"][3])
            
            # Align face crop
            aligned_face = face_svc.get_aligned_face(img, face_meta["raw_face"])
            if aligned_face is None:
                failure_count += 1
                continue
                
            # Perform quality evaluation
            eval_metrics = face_svc.evaluate_quality(
                face_meta["box"], 
                face_meta["landmarks"], 
                img.shape
            )
            
            # Mask detection heuristic
            is_masked, quality_score = detection_svc.detect_mask_heuristic(aligned_face)
            
            # Extract 1D 128 elements embedding
            embedding = face_svc.get_embedding(aligned_face)
            if embedding is None:
                failure_count += 1
                continue
                
            # Store embedding on disk
            emb_dir = Path(Config.DATASETS_DIR) / sample.person_id / "faces"
            emb_dir.mkdir(parents=True, exist_ok=True)
            
            emb_filename = f"{Path(sample.file_path).stem}_emb.npy"
            emb_path = emb_dir / emb_filename
            
            np.save(str(emb_path), embedding)
            
            # Update DB record
            sample.embedding_path = str(emb_path)
            sample.is_masked = is_masked
            sample.is_aligned = True
            sample.quality_score = float(quality_score)
            
            success_count += 1
        except Exception as e:
            print(f"Exception extracting face features for sample {sample.id}: {e}")
            failure_count += 1
            
    try:
        db.session.commit()
        # Reload registered faces cache in memory
        detection_svc.load_registered_faces()
        
        return jsonify({
            "success": True,
            "message": f"Face feature extraction complete. Succeeded: {success_count}, Failed: {failure_count}",
            "extracted_count": success_count,
            "failed_count": failure_count
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "error": str(e)}), 500

@features_bp.route('/api/features/extract-gait', methods=['POST'])
def extract_gait_features():
    """Triggers gait sequence extraction for all recorded walk videos that have not been processed yet."""
    detection_svc = getattr(current_app, 'detection_service', None)
    if not detection_svc:
        return jsonify({"success": False, "error": "Detection service not initialized"}), 500
        
    gait_svc = detection_svc.gait_service
    
    # Query all videos that don't have associated features
    # (Checking if video_id exists in GaitFeature table)
    from sqlalchemy import not_
    unprocessed_videos = GaitVideo.query.filter(
        not_(GaitVideo.id.in_(
            db.session.query(GaitFeature.video_id).filter(GaitFeature.video_id != None)
        ))
    ).all()
    
    if not unprocessed_videos:
        return jsonify({"success": True, "message": "All gait videos already have features extracted.", "count": 0})
        
    success_count = 0
    failure_count = 0
    details = []
    
    for video in unprocessed_videos:
        if not os.path.exists(video.file_path):
            failure_count += 1
            continue
            
        try:
            # Process video using GaitService MediaPipe loop
            agg_vec, frame_count = gait_svc.extract_from_video(video.file_path)
            if agg_vec is None:
                failure_count += 1
                details.append({
                    "video": video.video_name,
                    "success": False,
                    "reason": f"Insufficient tracking points found (frames={frame_count})"
                })
                continue
                
            # Create features directory if missing
            feat_dir = Path(Config.DATASETS_DIR) / video.person_id / "gait"
            feat_dir.mkdir(parents=True, exist_ok=True)
            
            feat_filename = f"{Path(video.file_path).stem}_feat.npy"
            feat_path = feat_dir / feat_filename
            
            # Save numpy array to disk
            np.save(str(feat_path), agg_vec)
            
            # Insert record in SQLite
            g_feature = GaitFeature(
                person_id=video.person_id,
                video_id=video.id,
                feature_path=str(feat_path),
                sequence_length=frame_count
            )
            db.session.add(g_feature)
            
            success_count += 1
            details.append({
                "video": video.video_name,
                "success": True,
                "frames": frame_count
            })
            
        except Exception as e:
            print(f"Exception extracting gait features for video {video.id}: {e}")
            failure_count += 1
            details.append({
                "video": video.video_name,
                "success": False,
                "reason": str(e)
            })
            
    try:
        db.session.commit()
        return jsonify({
            "success": True,
            "message": f"Gait feature extraction complete. Succeeded: {success_count}, Failed: {failure_count}",
            "extracted_count": success_count,
            "failed_count": failure_count,
            "details": details
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "error": str(e)}), 500
