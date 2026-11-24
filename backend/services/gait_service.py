import cv2
import numpy as np
import mediapipe as mp
from pathlib import Path
import joblib
import os
from config import Config

class GaitService:
    def __init__(self):
        # Initialize MediaPipe Pose Tasks API
        from mediapipe.tasks import python
        from mediapipe.tasks.python import vision

        model_file_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "models", "pose_landmarker_full.task")
        
        base_options = python.BaseOptions(model_asset_path=model_file_path)
        options = vision.PoseLandmarkerOptions(
            base_options=base_options,
            output_segmentation_masks=False,
            running_mode=vision.RunningMode.IMAGE
        )
        self.landmarker = vision.PoseLandmarker.create_from_options(options)
        
        # Paths for trained models
        self.model_path = Path(Config.MODELS_DIR) / "gait_model.joblib"
        self.scaler_path = Path(Config.MODELS_DIR) / "scaler.joblib"
        
        self.model = None
        self.scaler = None
        self.gait_threshold = Config.GAIT_CONFIDENCE_THRESHOLD
        self.load_model()
        
    def load_model(self):
        """Load trained gait model and scaler if they exist."""
        if self.model_path.exists() and self.scaler_path.exists():
            try:
                self.model = joblib.load(self.model_path)
                self.scaler = joblib.load(self.scaler_path)
                print("Gait model and scaler loaded successfully.")
                return True
            except Exception as e:
                print(f"Error loading gait model/scaler: {e}")
        else:
            print("Gait model not yet trained. Run training before inference.")
        return False

    def calculate_angle(self, a, b, c):
        """Calculate the angle between three 2D or 3D points (angle at point B)."""
        a = np.array(a) # Point A
        b = np.array(b) # Point B (vertex)
        c = np.array(c) # Point C

        ba = a - b
        bc = c - b

        cosine_angle = np.dot(ba, bc) / (np.linalg.norm(ba) * np.linalg.norm(bc) + 1e-10)
        cosine_angle = np.clip(cosine_angle, -1.0, 1.0)
        angle = np.arccos(cosine_angle)

        return np.degrees(angle)

    def extract_landmarks_from_frame(self, frame_rgb):
        """Extract pose landmarks from an RGB numpy frame.
        Returns a dictionary of relevant landmarks.
        """
        # Convert to MediaPipe Image object
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=frame_rgb)
        
        # Detect pose landmarks
        results = self.landmarker.detect(mp_image)
        
        if not results.pose_world_landmarks:
            return None
            
        # Use pose_world_landmarks which are in meters (dist-normalized)
        landmarks = results.pose_world_landmarks[0]
        
        # Build landmark index map using standard indexes
        lm = {
            "nose": landmarks[0],
            "l_shoulder": landmarks[11],
            "r_shoulder": landmarks[12],
            "l_elbow": landmarks[13],
            "r_elbow": landmarks[14],
            "l_wrist": landmarks[15],
            "r_wrist": landmarks[16],
            "l_hip": landmarks[23],
            "r_hip": landmarks[24],
            "l_knee": landmarks[25],
            "r_knee": landmarks[26],
            "l_ankle": landmarks[27],
            "r_ankle": landmarks[28],
        }
        
        # Format as numeric 3D coordinates [x, y, z]
        coord_lm = {}
        for name, val in lm.items():
            coord_lm[name] = np.array([val.x, val.y, val.z])
            
        return coord_lm

    def compute_frame_features(self, landmarks):
        """Compute structural and dynamic characteristics for a single pose frame."""
        # Joints angles
        l_knee_angle = self.calculate_angle(landmarks["l_hip"], landmarks["l_knee"], landmarks["l_ankle"])
        r_knee_angle = self.calculate_angle(landmarks["r_hip"], landmarks["r_knee"], landmarks["r_ankle"])
        
        l_hip_angle = self.calculate_angle(landmarks["l_shoulder"], landmarks["l_hip"], landmarks["l_knee"])
        r_hip_angle = self.calculate_angle(landmarks["r_shoulder"], landmarks["r_hip"], landmarks["r_knee"])
        
        l_elbow_angle = self.calculate_angle(landmarks["l_shoulder"], landmarks["l_elbow"], landmarks["l_wrist"])
        r_elbow_angle = self.calculate_angle(landmarks["r_shoulder"], landmarks["r_elbow"], landmarks["r_wrist"])
        
        # Spatial joint distances (in meters, since we use world landmarks)
        ankle_distance = np.linalg.norm(landmarks["l_ankle"] - landmarks["r_ankle"])
        knee_distance = np.linalg.norm(landmarks["l_knee"] - landmarks["r_knee"])
        wrist_distance = np.linalg.norm(landmarks["l_wrist"] - landmarks["r_wrist"])
        
        # Torso height normalization factor (in case we need relative dimensions)
        shoulder_center = (landmarks["l_shoulder"] + landmarks["r_shoulder"]) / 2.0
        hip_center = (landmarks["l_hip"] + landmarks["r_hip"]) / 2.0
        torso_height = np.linalg.norm(shoulder_center - hip_center) + 1e-10
        
        features = [
            l_knee_angle,
            r_knee_angle,
            l_hip_angle,
            r_hip_angle,
            l_elbow_angle,
            r_elbow_angle,
            ankle_distance / torso_height, # Normalized relative stride
            knee_distance / torso_height,
            wrist_distance / torso_height
        ]
        return features

    def aggregate_sequence_features(self, frame_features_seq):
        """Aggregate a sequence of frame feature vectors into a single statistical feature vector.
        Input: list or numpy array of shape (N, D), where N is frames and D is dimension.
        Output: a 1D numpy array of shape (D * 7,) representing the statistical moments.
        """
        feats = np.array(frame_features_seq) # shape (N, D)
        if len(feats) < 5:
            return None # Insufficient frames to extract temporal features
            
        aggregated = []
        for i in range(feats.shape[1]):
            col = feats[:, i]
            
            # Extract statistical metrics
            mean_val = np.mean(col)
            std_val = np.std(col)
            min_val = np.min(col)
            max_val = np.max(col)
            range_val = max_val - min_val
            pct25 = np.percentile(col, 25)
            pct75 = np.percentile(col, 75)
            
            aggregated.extend([mean_val, std_val, min_val, max_val, range_val, pct25, pct75])
            
        return np.array(aggregated)

    def extract_from_video(self, video_path):
        """Processes a video file, extracts pose landmarks frame-by-frame,
        and computes the aggregated feature vector for the gait sequence.
        """
        cap = cv2.VideoCapture(str(video_path))
        if not cap.isOpened():
            print(f"Error opening video: {video_path}")
            return None, 0
            
        frame_feats_seq = []
        frame_count = 0
        
        while True:
            ret, frame = cap.read()
            if not ret:
                break
                
            frame_count += 1
            # Downsample frames to speed up processing
            if frame_count % 2 != 0:
                continue
                
            frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            landmarks = self.extract_landmarks_from_frame(frame_rgb)
            if landmarks:
                frame_feat = self.compute_frame_features(landmarks)
                frame_feats_seq.append(frame_feat)
                
        cap.release()
        
        if len(frame_feats_seq) < 10:
            print(f"Failed to retrieve enough valid poses from {video_path}. Found only {len(frame_feats_seq)} poses.")
            return None, len(frame_feats_seq)
            
        aggregated_vector = self.aggregate_sequence_features(frame_feats_seq)
        return aggregated_vector, len(frame_feats_seq)

    def predict(self, aggregated_vector):
        """Make class predictions and probabilities for a gait sequence.
        Returns: best_match_person_id, confidence_score
        """
        if aggregated_vector is None:
            return "Unknown", 0.0

        if self.model is None or self.scaler is None:
            self.load_model()
            if self.model is None or self.scaler is None:
                return "Unknown", 0.0
                
        try:
            # Scale feature vector
            scaled_vec = self.scaler.transform(aggregated_vector.reshape(1, -1))
            
            # Predict probability
            prob = self.model.predict_proba(scaled_vec)[0]
            pred_idx = np.argmax(prob)
            score = float(prob[pred_idx])
            person_id = self.model.classes_[pred_idx]
            
            # Check recognition confidence threshold
            if score < self.gait_threshold:
                return "Unknown", score
                
            return person_id, score
        except Exception as e:
            print(f"Gait prediction failed: {e}")
            return "Unknown", 0.0
            
    def shutdown(self):
        """Releases the Pose landmarker resource."""
        self.landmarker.close()
