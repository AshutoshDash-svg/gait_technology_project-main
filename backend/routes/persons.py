import os
import uuid
from flask import Blueprint, request, jsonify, current_app
from werkzeug.utils import secure_filename
from pathlib import Path
from database.db import db
from database.models import Person, FaceSample, GaitVideo
from config import Config

persons_bp = Blueprint('persons', __name__)

ALLOWED_FACE_EXT = {'.png', '.jpg', '.jpeg', '.webp'}
ALLOWED_VIDEO_EXT = {'.mp4', '.avi', '.mov', '.mkv', '.webm'}

def allowed_file(filename, allowed_set):
    ext = Path(filename).suffix.lower()
    return ext in allowed_set

@persons_bp.route('/api/persons', methods=['POST'])
def create_person():
    """Register a new person in the database."""
    data = request.json or {}
    name = data.get('name')
    person_id = data.get('person_id')
    
    if not name or not person_id:
        return jsonify({"success": False, "error": "Name and Person ID are required"}), 400
        
    # Check if person_id already exists
    existing = Person.query.filter_by(person_id=person_id).first()
    if existing:
        return jsonify({"success": False, "error": f"Person with ID {person_id} already exists"}), 400
        
    try:
        person = Person(person_id=person_id, name=name)
        db.session.add(person)
        db.session.commit()
        return jsonify({"success": True, "data": person.to_dict()}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "error": str(e)}), 500

@persons_bp.route('/api/persons', methods=['GET'])
def get_persons():
    """Get list of all registered persons."""
    try:
        persons = Person.query.order_by(Person.created_at.desc()).all()
        return jsonify({"success": True, "data": [p.to_dict() for p in persons]})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@persons_bp.route('/api/persons/<person_id>', methods=['GET'])
def get_person_details(person_id):
    """Retrieve details for a single person profile, including metadata of samples."""
    person = Person.query.filter_by(person_id=person_id).first()
    if not person:
        return jsonify({"success": False, "error": "Person not found"}), 404
        
    details = person.to_dict()
    details["face_samples"] = [fs.to_dict() for fs in person.face_samples]
    details["gait_videos"] = [gv.to_dict() for gv in person.gait_videos]
    details["gait_features"] = [gf.to_dict() for gf in person.gait_features]
    
    return jsonify({"success": True, "data": details})

@persons_bp.route('/api/persons/<person_id>', methods=['DELETE'])
def delete_person(person_id):
    """Deletes a person, their database records, and their associated data on disk."""
    person = Person.query.filter_by(person_id=person_id).first()
    if not person:
        return jsonify({"success": False, "error": "Person not found"}), 404
        
    try:
        # 1. Delete files from disk first. Delete each file individually with try-except to avoid Windows locking crashes.
        person_dir = Path(Config.DATASETS_DIR) / person_id
        if person_dir.exists():
            for root, dirs, files in os.walk(str(person_dir), topdown=False):
                for name in files:
                    file_path = os.path.join(root, name)
                    try:
                        os.chmod(file_path, 0o777)
                        os.remove(file_path)
                    except Exception as fe:
                        print(f"Could not remove file {file_path}: {fe}")
                for name in dirs:
                    dir_path = os.path.join(root, name)
                    try:
                        os.rmdir(dir_path)
                    except Exception as de:
                        print(f"Could not remove directory {dir_path}: {de}")
            try:
                os.rmdir(str(person_dir))
            except Exception as pe:
                print(f"Could not remove root directory {person_dir}: {pe}")
            
        # 2. Delete detection history records for this person
        from database.models import DetectionHistory, Alert
        DetectionHistory.query.filter_by(person_id=person_id).delete(synchronize_session=False)
        DetectionHistory.query.filter_by(name=person.name).delete(synchronize_session=False)

        # 3. Delete matching Alarms and Security logs referencing the person
        from sqlalchemy import or_
        alert_pattern = f"%{person_id}%"
        name_pattern = f"%{person.name}%"
        Alert.query.filter(
            or_(
                getattr(Alert, 'details').like(alert_pattern),
                getattr(Alert, 'details').like(name_pattern)
            )
        ).delete(synchronize_session=False)

        # 4. Clean up trained model files since the dataset changed
        model_dir = Path(Config.MODELS_DIR)
        for model_file in ["gait_model.joblib", "scaler.joblib", "model_metadata.joblib"]:
            file_path = model_dir / model_file
            if file_path.exists():
                try:
                    os.chmod(str(file_path), 0o777)
                    os.remove(str(file_path))
                except Exception as e:
                    print(f"Error removing model file {file_path}: {e}")

        db.session.delete(person)
        db.session.commit()
        
        # Trigger cache update on active detection service if running
        from flask import current_app
        detection_svc = getattr(current_app, 'detection_service', None)
        if detection_svc is not None:
            detection_svc.load_registered_faces()
            # Reset / reload gait service classifier to unload it from memory
            gait_svc = getattr(detection_svc, 'gait_service', None)
            if gait_svc is not None:
                gait_svc.load_model()
            
        return jsonify({"success": True, "message": f"Person {person_id} deleted successfully."})
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "error": str(e)}), 500

@persons_bp.route('/api/persons/<person_id>/face-samples', methods=['POST'])
def upload_face_samples(person_id):
    """Handles upload of face images for registration."""
    person = Person.query.filter_by(person_id=person_id).first()
    if not person:
        return jsonify({"success": False, "error": "Person not found"}), 404
        
    if 'files' not in request.files:
        return jsonify({"success": False, "error": "No file streams found in request"}), 400
        
    files = request.files.getlist('files')
    if not files or files[0].filename == '':
        return jsonify({"success": False, "error": "No files selected"}), 400
        
    # Directories
    faces_dir = Path(Config.DATASETS_DIR) / person_id / "faces"
    faces_dir.mkdir(parents=True, exist_ok=True)
    
    uploaded_records = []
    
    try:
        for file in files:
            filename = file.filename or ""
            if file and allowed_file(filename, ALLOWED_FACE_EXT):
                # Clean name
                orig_name = secure_filename(filename)
                unique_name = f"{uuid.uuid4().hex}_{orig_name}"
                dest_path = faces_dir / unique_name
                
                # Save file
                file.save(str(dest_path))
                
                # Write record
                f_sample = FaceSample(
                    person_id=person_id,
                    file_path=str(dest_path),
                    is_masked=False,
                    is_aligned=False,
                    quality_score=1.0
                )
                db.session.add(f_sample)
                uploaded_records.append(f_sample)
                
        db.session.commit()
        return jsonify({
            "success": True, 
            "message": f"Successfully uploaded {len(uploaded_records)} face samples.",
            "data": [r.to_dict() for r in uploaded_records]
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "error": str(e)}), 500

@persons_bp.route('/api/persons/<person_id>/gait-samples', methods=['POST'])
def upload_gait_samples(person_id):
    """Handles upload of walking video sequences for registration."""
    person = Person.query.filter_by(person_id=person_id).first()
    if not person:
        return jsonify({"success": False, "error": "Person not found"}), 404
        
    if 'file' not in request.files:
        return jsonify({"success": False, "error": "No file stream found in request"}), 400
        
    file = request.files['file']
    if file.filename == '':
        return jsonify({"success": False, "error": "No file selected"}), 400
        
    filename = file.filename or ""
    if file and allowed_file(filename, ALLOWED_VIDEO_EXT):
        gait_dir = Path(Config.DATASETS_DIR) / person_id / "gait"
        gait_dir.mkdir(parents=True, exist_ok=True)
        
        try:
            # Clean filename
            orig_name = secure_filename(filename)
            unique_name = f"{uuid.uuid4().hex}_{orig_name}"
            dest_path = gait_dir / unique_name
            
            # Save file
            file.save(str(dest_path))
            
            # Save record
            gait_vid = GaitVideo(
                person_id=person_id,
                file_path=str(dest_path),
                video_name=orig_name
            )
            db.session.add(gait_vid)
            db.session.commit()
            
            return jsonify({
                "success": True,
                "message": "Walking video uploaded successfully.",
                "data": gait_vid.to_dict()
            }), 201
        except Exception as e:
            db.session.rollback()
            return jsonify({"success": False, "error": str(e)}), 500
            
    return jsonify({"success": False, "error": "File type not supported"}), 400

@persons_bp.route('/api/persons/<person_id>/enroll-face', methods=['POST'])
def enroll_face_sample(person_id):
    """Detect face using YuNet pipeline, validate exactly one face, and save sequentially."""
    person = Person.query.filter_by(person_id=person_id).first()
    if not person:
        return jsonify({"success": False, "error": "Person not found"}), 404
        
    if 'file' not in request.files:
        return jsonify({"success": False, "error": "No file stream found in request"}), 400
        
    file = request.files['file']
    if file.filename == '':
        return jsonify({"success": False, "error": "No file selected"}), 400

    import cv2
    import numpy as np

    try:
        file_bytes = np.frombuffer(file.read(), np.uint8)
        img = cv2.imdecode(file_bytes, cv2.IMREAD_COLOR)
        if img is None:
            return jsonify({"success": False, "error": "Failed to decode image"}), 400

        # Face detection
        detection_svc = getattr(current_app, 'detection_service', None)
        if detection_svc is None:
            return jsonify({"success": False, "error": "Detection service not initialized"}), 500
        
        face_svc = getattr(detection_svc, 'face_service', None)
        if face_svc is None:
            return jsonify({"success": False, "error": "Face detection service not initialized"}), 500

        faces = face_svc.detect_faces(img)

        # Filter out very low confidence detections to ignore background noise / artifacts
        confident_faces = [f for f in faces if f.get("confidence", 0) >= 0.70]

        if len(confident_faces) == 0:
            return jsonify({"success": False, "error": "No face detected in the frame. Please look at the camera."}), 400

        # If multiple faces are detected, check if there is a dominant primary face (closest to camera)
        if len(confident_faces) > 1:
            # Sort by bounding box area descending
            sorted_faces = sorted(confident_faces, key=lambda f: f["box"][2] * f["box"][3], reverse=True)
            largest_area = sorted_faces[0]["box"][2] * sorted_faces[0]["box"][3]
            second_largest_area = sorted_faces[1]["box"][2] * sorted_faces[1]["box"][3]
            
            # If the largest face is significantly larger (at least 1.5x in area), we assume it's the user
            if largest_area >= 1.5 * second_largest_area:
                faces = [sorted_faces[0]]
            else:
                return jsonify({"success": False, "error": "Multiple faces of similar size detected. Exactly one face must be visible."}), 400

        # Save details
        faces_dir = Path(Config.DATASETS_DIR) / person_id / "faces"
        faces_dir.mkdir(parents=True, exist_ok=True)

        # Determine sequential name face_01.jpg, face_02.jpg...
        existing_files = list(faces_dir.glob("face_*.jpg"))
        numbers = []
        for f in existing_files:
            stem = f.stem # face_XX
            try:
                num = int(stem.split("_")[-1])
                numbers.append(num)
            except ValueError:
                pass
        next_num = max(numbers) + 1 if numbers else 1
        filename = f"face_{next_num:02d}.jpg"
        dest_path = faces_dir / filename

        cv2.imwrite(str(dest_path), img)

        f_sample = FaceSample(
            person_id=person_id,
            file_path=str(dest_path),
            is_masked=False,
            is_aligned=False,
            quality_score=1.0
        )
        db.session.add(f_sample)
        db.session.commit()
        
        return jsonify({
            "success": True,
            "message": "Face sample captured and verified successfully.",
            "data": f_sample.to_dict()
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "error": str(e)}), 500

@persons_bp.route('/api/persons/<person_id>/enroll-gait', methods=['POST'])
def enroll_gait_sample(person_id):
    """Saves a real-time recorded walking video sequentially."""
    person = Person.query.filter_by(person_id=person_id).first()
    if not person:
        return jsonify({"success": False, "error": "Person not found"}), 404
        
    if 'file' not in request.files:
        return jsonify({"success": False, "error": "No file stream found in request"}), 400
        
    file = request.files['file']
    if file.filename == '':
        return jsonify({"success": False, "error": "No file selected"}), 400

    gait_dir = Path(Config.DATASETS_DIR) / person_id / "gait"
    gait_dir.mkdir(parents=True, exist_ok=True)
    
    filename = file.filename or ""
    ext = Path(filename).suffix.lower()
    if not ext:
        ext = ".mp4"
    if ext not in ALLOWED_VIDEO_EXT:
        return jsonify({"success": False, "error": "Video format not supported"}), 400

    # Determine sequential name walk_01.mp4, walk_02.mp4...
    existing_files = list(gait_dir.glob("walk_*" + ext))
    if ext != ".mp4":
        existing_files.extend(list(gait_dir.glob("walk_*.mp4")))
        
    numbers = []
    for f in existing_files:
        stem = f.stem # walk_XX
        try:
            num = int(stem.split("_")[-1])
            numbers.append(num)
        except ValueError:
            pass
    next_num = max(numbers) + 1 if numbers else 1
    filename = f"walk_{next_num:02d}{ext}"
    dest_path = gait_dir / filename

    try:
        file.save(str(dest_path))
        
        gait_vid = GaitVideo(
            person_id=person_id,
            file_path=str(dest_path),
            video_name=filename
        )
        db.session.add(gait_vid)
        db.session.commit()
        
        return jsonify({
            "success": True,
            "message": "Walking video sequence enrolled successfully.",
            "data": gait_vid.to_dict()
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "error": str(e)}), 500

