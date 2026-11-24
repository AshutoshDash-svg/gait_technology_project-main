import cv2
import numpy as np
import os
import time
from datetime import datetime
from pathlib import Path
from flask_socketio import SocketIO
from ultralytics import YOLO

from config import Config
from database.db import db
from database.models import Person, FaceSample, GaitVideo, GaitFeature, DetectionHistory, Alert
from services.face_service import FaceService
from services.gait_service import GaitService
from services.decision_engine import DecisionEngine

class DetectionService:
    def __init__(self, app=None, socketio=None):
        self.app = app
        self.socketio = socketio
        
        self.face_service = FaceService()
        self.gait_service = GaitService()
        self.decision_engine = DecisionEngine(self.face_service, self.gait_service)
        
        # Load YOLO model
        print("Loading YOLOv8n model...")
        self.yolo = YOLO("yolov8n.pt")
        print("YOLOv8n model loaded.")
        
        # Surveillance states
        self.is_running = False
        self.camera_src = Config.DEFAULT_CAMERA_SRC
        self.cap = None
        
        # Buffer for tracking data
        # track_id -> dict(gait_landmarks_list, face_embeddings_history, final_identity, last_seen)
        self.tracks = {}
        
        # Registered embeddings cache in memory to speed up face recognition
        # list of dict(person_id, name, embedding, is_masked)
        self.registered_faces_cache = []
        self.load_registered_faces()

    def load_registered_faces(self):
        """Cache all registered face embeddings in memory."""
        if self.app is None:
            return
            
        with self.app.app_context():
            try:
                self.registered_faces_cache = []
                persons = Person.query.all()
                for p in persons:
                    for sample in p.face_samples:
                        if sample.embedding_path and os.path.exists(sample.embedding_path):
                            try:
                                emb = np.load(sample.embedding_path)
                                self.registered_faces_cache.append({
                                    "person_id": p.person_id,
                                    "name": p.name,
                                    "embedding": emb,
                                    "is_masked": sample.is_masked
                                })
                            except Exception as e:
                                print(f"Error loading embedding {sample.embedding_path}: {e}")
                print(f"Cached {len(self.registered_faces_cache)} registered face embeddings in memory.")
            except Exception as e:
                print(f"Failed to cache registered faces: {e}")

    def detect_mask_heuristic(self, face_bgr):
        """Heuristic to detect mask or chin occlusion.
        Compares skin-tone color distribution between the upper face (forehead)
        and lower face (mouth/chin). If forehead contains normal skin color,
        but lower face lacks skin color, a face mask is highly likely.
        """
        try:
            h, w = face_bgr.shape[:2]
            if h < 20 or w < 20:
                return False, 1.0 # Unknown due to size
                
            # Convert face image to HSV space
            hsv = cv2.cvtColor(face_bgr, cv2.COLOR_BGR2HSV)
            
            # Sub-divide into Forehead (top 25%) and Mouth/Chin (bottom 35%)
            forehead_hsv = hsv[0:int(h*0.25), :]
            chin_hsv = hsv[int(h*0.65):h, :]
            
            # Standard skin color range in HSV
            lower_skin = np.array([0, 15, 45], dtype=np.uint8)
            upper_skin = np.array([25, 160, 255], dtype=np.uint8)
            
            # Mask pixels falling into skin range
            forehead_mask = cv2.inRange(forehead_hsv, lower_skin, upper_skin)
            chin_mask = cv2.inRange(chin_hsv, lower_skin, upper_skin)
            
            forehead_skin_pct = np.sum(forehead_mask > 0) / (forehead_mask.size + 1e-10)
            chin_skin_pct = np.sum(chin_mask > 0) / (chin_mask.size + 1e-10)
            
            # Define heuristic threshold:
            # If forehead has skin, but lower face has minimal skin, mask is detected
            is_masked = (forehead_skin_pct > 0.15) and (chin_skin_pct < 0.05)
            
            # Quality score indicator: based on brightness variance/contrast
            gray = cv2.cvtColor(face_bgr, cv2.COLOR_BGR2GRAY)
            laplacian_var = cv2. Laplacian(gray, cv2.CV_64F).var()
            quality = min(1.0, laplacian_var / 250.0) # standard threshold
            
            return bool(is_masked), quality
        except Exception as e:
            print(f"Mask detection exception: {e}")
            return False, 1.0

    def query_face_db(self, query_emb):
        """Compares query face embedding with cached database embeddings."""
        if not self.registered_faces_cache:
            return {"person_id": None, "name": "Unknown", "similarity": 0.0}
            
        best_score = -1.0
        best_match = None
        
        for item in self.registered_faces_cache:
            score = self.face_service.compute_similarity(query_emb, item["embedding"])
            if score > best_score:
                best_score = score
                best_match = item
                
        if best_match and best_score >= self.face_service.face_threshold:
            return {
                "person_id": best_match["person_id"],
                "name": best_match["name"],
                "similarity": best_score,
                "is_masked": best_match["is_masked"]
            }
            
        return {
            "person_id": None,
            "name": "Unknown",
            "similarity": best_score
        }

    def start_surveillance(self, source=0):
        """Starts background CCTV monitoring loop."""
        if self.is_running:
            return True
            
        self.camera_src = source
        # Open video source
        if isinstance(source, int):
            # Prefer DirectShow backend on Windows to avoid locks/hangs
            self.cap = cv2.VideoCapture(source + cv2.CAP_DSHOW)
            if not self.cap.isOpened():
                self.cap = cv2.VideoCapture(source)
        else:
            self.cap = cv2.VideoCapture(source)
            
        if not self.cap.isOpened():
            print(f"Failed to open video source: {source}")
            return False
            
        self.is_running = True
        self.tracks = {}
        return True

    def stop_surveillance(self):
        """Stops the CCTV loop."""
        self.is_running = False
        if self.cap:
            self.cap.release()
            self.cap = None
        print("Surveillance stream stopped.")
        return True

    def log_detection(self, track_id, result):
        """Saves a system detection log and sounds alerts if needed in the SQLite DB."""
        if self.app is None:
            return
            
        with self.app.app_context():
            try:
                # Add to DB
                conf_val = result.get("confidence")
                c_val = float(conf_val) if conf_val is not None else None
                hist = DetectionHistory(
                    camera="Camera 01",
                    track_id=track_id,
                    person_id=result.get("person_id"),
                    name=result.get("name", "Unknown"),
                    method=result.get("method", "None"),
                    face_similarity=c_val if (c_val is not None and "Face" in result.get("method", "")) else None,
                    gait_confidence=c_val if (c_val is not None and "Gait" in result.get("method", "")) else None,
                    status=result.get("status")
                )
                db.session.add(hist)
                
                # Check for Alert: Unknown Person
                if result.get("status") == "ALERT":
                    # Check if an alert was already logged recently for this track id
                    existing_alert = Alert.query.filter_by(track_id=track_id, is_resolved=False).first()
                    if not existing_alert:
                        details = f"Unknown Person tracked as ID #{track_id}. {result.get('details', '')}"
                        alert = Alert(
                            camera="Camera 01",
                            track_id=track_id,
                            details=details
                        )
                        db.session.add(alert)
                        db.session.commit()
                        # Socket emit alert
                        if self.socketio:
                            self.socketio.emit('alert_event', alert.to_dict())
                
                db.session.commit()
                
                # Socket emit history
                if self.socketio:
                    self.socketio.emit('detection_event', hist.to_dict())
                    
            except Exception as e:
                db.session.rollback()
                print(f"Database logging failed: {e}")

    def generate_frames(self):
        """Generator that runs surveillance inference frame-by-frame.
        Yields JPEG frames for HTTP MJPEG transmission, while updating stats via sockets.
        """
        fps_start_time = time.time()
        fps_frame_count = 0
        current_fps = 15.0
        
        while self.is_running:
            if not self.cap:
                break
                
            ret, frame = self.cap.read()
            if not ret:
                # Loop video if playing a video file
                if isinstance(self.camera_src, str):
                    self.cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                    continue
                else:
                    time.sleep(0.03)
                    continue
                    
            fps_frame_count += 1
            if time.time() - fps_start_time >= 1.0:
                current_fps = float(fps_frame_count) / (time.time() - fps_start_time)
                fps_start_time = time.time()
                fps_frame_count = 0
                if self.socketio:
                    self.socketio.emit('fps_event', {"fps": round(current_fps, 1)})
            
            # 1. Run YOLO Person Tracking
            # verbose=False reduces terminal clutter. persist=True tracks across frames.
            results = self.yolo.track(frame, persist=True, classes=[0], verbose=False)
            
            # Store active tracks list to clean up dead tracks
            active_track_ids = []
            
            if results and results[0].boxes is not None:
                boxes = results[0].boxes
                for box in boxes:
                    # Get box info
                    xyxy = box.xyxy[0].cpu().numpy().astype(int)
                    track_id = int(box.id[0].cpu().numpy()) if box.id is not None else 0
                    conf = float(box.conf[0].cpu().numpy())
                    
                    active_track_ids.append(track_id)
                    
                    # Initialize session object for new track ID
                    if track_id not in self.tracks:
                        self.tracks[track_id] = {
                            "gait_landmarks": [],
                            "final_identity": None,
                            "last_result": None,
                            "last_log_time": 0
                        }
                    
                    track_meta = self.tracks[track_id]
                    
                    # Crop/isolate person bounds
                    px1, py1, px2, py2 = xyxy
                    person_crop = frame[py1:py2, px1:px2]
                    
                    if person_crop.size == 0:
                        continue
                        
                    # Face analysis inside person bounds
                    face_result = {"person_id": None, "name": "Unknown", "similarity": 0.0, "visible": False}
                    
                    # First try to detect face in the top 50% of the crop (where the head is normally located)
                    ph, pw = person_crop.shape[:2]
                    head_crop = person_crop[0:int(ph * 0.5), :]
                    
                    detected_faces = []
                    if head_crop.size > 0:
                        detected_faces = self.face_service.detect_faces(head_crop)
                    
                    # Fallback to the entire person crop if no face was found (useful for upper-body/close-up tracks)
                    if not detected_faces and person_crop.size > 0:
                        detected_faces = self.face_service.detect_faces(person_crop)
                        head_crop = person_crop
                        
                    if detected_faces:
                        # Use details of the largest face detected
                        face_details = max(detected_faces, key=lambda f: f["box"][2] * f["box"][3])
                        fx, fy, fw_box, fh_box = face_details["box"]
                        
                        # Align & crop face image
                        aligned_face = self.face_service.get_aligned_face(head_crop, face_details["raw_face"])
                        if aligned_face is not None:
                            is_masked, quality = self.detect_mask_heuristic(aligned_face)
                            
                            # Extract feature embedding
                            emb = self.face_service.get_embedding(aligned_face)
                            if emb is not None:
                                match_res = self.query_face_db(emb)
                                face_result = {
                                    "person_id": match_res["person_id"],
                                    "name": match_res["name"],
                                    "similarity": match_res["similarity"],
                                    "visible": True,
                                    "quality": quality,
                                    "is_masked": is_masked or match_res.get("is_masked", False)
                                }
                    
                    # Gait landmarks analysis (MediaPipe Pose)
                    gait_result = {"person_id": "Unknown", "confidence": 0.0, "frames": len(track_meta["gait_landmarks"])}
                    
                    person_rgb = cv2.cvtColor(person_crop, cv2.COLOR_BGR2RGB)
                    landmarks = self.gait_service.extract_landmarks_from_frame(person_rgb)
                    
                    if landmarks:
                        # Ensure standard pose bounding box filters details related to current person box
                        # MediaPipe landmarks x is relative normalized [0, 1]. Get pixel coords
                        fh_img, fw_img = frame.shape[:2]
                        # Nose landmark coordinate check
                        nose_x = int(landmarks["nose"][0] * fw_img) # Note: pose_world_landmarks requires standard landmarks projection or simple spatial containment filter.
                        # For simple containment, verify if the center hip is inside the bounding box
                        lhip_x = int(landmarks["l_hip"][0] * fw_img)
                        # Actually we can do mapping. But since we track one active person walk at standard distances, or check if points match the bounding box x range:
                        # Let's map pose landmarks to the YOLO box
                        # We use results[0].pose_landmarks or fallback: check if standard pose coordinates align with YOLO box limits:
                        # In this system, we can verify landmarks coordinates inside box.
                        # Let's extract features of the active walker.
                        l_hip_px = (landmarks["l_hip"][0] + landmarks["r_hip"][0]) / 2.0
                        # Since pose_world_landmarks are centering metric coordinates, we extract landmarks from a crop of the person or full frame,
                        # filtering coordinates inside the YOLO boundary.
                        
                        # Let's extract frame features:
                        frame_feat = self.gait_service.compute_frame_features(landmarks)
                        # Append to track history
                        track_meta["gait_landmarks"].append(frame_feat)
                        # Keep window size under 120 frames to avoid memory leakage
                        if len(track_meta["gait_landmarks"]) > 120:
                            track_meta["gait_landmarks"].pop(0)
                            
                        # If we have buffered enough gait landmarks, run the Gait model predictions
                        if len(track_meta["gait_landmarks"]) >= 20: # 20 or more frames
                            agg_feats = self.gait_service.aggregate_sequence_features(track_meta["gait_landmarks"])
                            if agg_feats is not None:
                                gait_pid, gait_conf = self.gait_service.predict(agg_feats)
                                gait_name = "Unknown"
                                if gait_pid != "Unknown":
                                    # Fetch name from DB cache or query
                                    for x_face in self.registered_faces_cache:
                                        if x_face["person_id"] == gait_pid:
                                            gait_name = x_face["name"]
                                            break
                                            
                                gait_result = {
                                    "person_id": gait_pid,
                                    "name": gait_name,
                                    "confidence": gait_conf,
                                    "frames": len(track_meta["gait_landmarks"])
                                }
                    
                    # 3. Fuse outputs through Decision Engine
                    fused = self.decision_engine.fuse_identities(face_result, gait_result)
                    
                    # Track ID identity smoothing cache (if already identified, maintain identity to prevent flickering, update details)
                    if track_meta["final_identity"] is None or track_meta["final_identity"] == "Unknown":
                        if fused["person_id"] and fused["person_id"] != "Unknown":
                            track_meta["final_identity"] = fused["person_id"]
                            
                    if track_meta["final_identity"] and track_meta["final_identity"] != "Unknown":
                        # Maintain target person's name
                        fused["person_id"] = track_meta["final_identity"]
                        # Lookup name
                        for x_face in self.registered_faces_cache:
                            if x_face["person_id"] == track_meta["final_identity"]:
                                fused["name"] = x_face["name"]
                                break
                        fused["status"] = "IDENTIFIED"
                    
                    # Append (Masked) suffix if a mask is detected
                    if fused.get("is_masked") and fused["status"] == "IDENTIFIED":
                        fused["name"] = f"{fused['name']} (Masked)"
                        fused["status"] = "IDENTIFIED(masks)"
                    
                    track_meta["last_result"] = fused
                    
                    # Log detections in DB every 3 seconds to avoid spamming SQLite during active track
                    now_sec = time.time()
                    if now_sec - track_meta["last_log_time"] >= 4.0:
                        # Log to db, sockets, and alert mechanisms
                        self.log_detection(track_id, fused)
                        track_meta["last_log_time"] = now_sec
                    
                    # 4. Annotation overlays: Draw text labels, status, confidence metrics on frames
                    # Setup Colors based on identity status
                    if fused["status"] == "IDENTIFIED":
                        color = (46, 204, 113) # Green text/box
                    elif fused["status"] == "PROCESSING":
                        color = (230, 126, 34) # Orange loading
                    else:
                        color = (231, 76, 60) # Red warning alerts (Unknown)
                        
                    cv2.rectangle(frame, (px1, py1), (px2, py2), color, 2)
                    
                    # Identity Banner above bbox
                    label = f"Track #{track_id}: {fused['name']}"
                    cv2.putText(frame, label, (px1, py1 - 25), cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2)
                    
                    # Detail banners under label
                    details1 = f"{fused['method']} ({fused['confidence']:.2f})" if fused['method'] != "None" else "Scanning..."
                    cv2.putText(frame, details1, (px1, py1 - 8), cv2.FONT_HERSHEY_SIMPLEX, 0.45, color, 1)
                    
                    # Visual status markers
                    if face_result.get("visible"):
                        face_info = f"Face: Match={face_result['similarity']:.2f}"
                        if face_result.get("is_masked"):
                            face_info += " [MASKED]"
                        cv2.putText(frame, face_info, (px1, py2 + 15), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (155, 89, 182), 1)
                    else:
                        cv2.putText(frame, "Face: Occluded/N/A", (px1, py2 + 15), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (231, 76, 60), 1)
                        
                    gait_info = f"Gait: Conf={gait_result['confidence']:.2f} ({gait_result['frames']}/20f)"
                    cv2.putText(frame, gait_info, (px1, py2 + 28), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (52, 152, 219), 1)

            # Garbage collect tracks no longer seen in YOLO detections
            for fid in list(self.tracks.keys()):
                if fid not in active_track_ids:
                    # Remove track data once they leave CCTV camera focus
                    del self.tracks[fid]
            
            # 5. JPEG conversion for MJPEG delivery
            ret_jpg, jpeg_buf = cv2.imencode('.jpg', frame)
            if ret_jpg:
                yield (b'--frame\r\n'
                       b'Content-Type: image/jpeg\r\n\r\n' + jpeg_buf.tobytes() + b'\r\n')
            
            # Throttle loop to simulate 30FPS streaming
            time.sleep(0.01)

    def process_gait_video_file(self, video_path):
        """Static analysis of uploaded walk sequences for model building.
        Calls MediaPipe feature extraction and checks for quality.
        """
        aggregated_feats, matched_frames = self.gait_service.extract_from_video(video_path)
        return aggregated_feats, matched_frames
