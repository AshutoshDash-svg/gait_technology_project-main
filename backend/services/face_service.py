import os
import cv2
import numpy as np
from pathlib import Path
from config import Config

class FaceService:
    def __init__(self):
        self.models_dir = Path(Config.MODELS_DIR)
        self.yunet_path = str(self.models_dir / "face_detection_yunet_2023mar.onnx")
        self.sface_path = str(self.models_dir / "face_recognition_sface_2021dec.onnx")
        
        # Keep references to the loaded models
        self.detector = None
        self.recognizer = None
        self.face_threshold = Config.FACE_SIMILARITY_THRESHOLD
        
        self.initialize_models()

    def initialize_models(self):
        """Load YuNet and SFace models if ONNX files exist."""
        if not os.path.exists(self.yunet_path) or not os.path.exists(self.sface_path):
            print(f"Error: Face models not found. Run download_weights.py first.")
            return False
        
        try:
            # We initialize YuNet with a dummy scale (320x320), it will be resized during detection
            self.detector = cv2.FaceDetectorYN.create(
                model=self.yunet_path,
                config="",
                input_size=(320, 320),
                score_threshold=0.6, # Custom threshold for detecting faces
                nms_threshold=0.3,
                top_k=10,
                backend_id=cv2.dnn.DNN_BACKEND_OPENCV,
                target_id=cv2.dnn.DNN_TARGET_CPU
            )
            
            self.recognizer = cv2.FaceRecognizerSF.create(
                model=self.sface_path,
                config="",
                backend_id=cv2.dnn.DNN_BACKEND_OPENCV,
                target_id=cv2.dnn.DNN_TARGET_CPU
            )
            print("Face models (YuNet and SFace) loaded successfully.")
            return True
        except Exception as e:
            print(f"Failed to initialize YuNet / SFace models: {e}")
            return False

    def detect_faces(self, frame, target_size=(320, 320)) -> list:
        """Detect faces in a frame. Sets input size dynamically."""
        if self.detector is None:
            self.initialize_models()
        if self.detector is None:
            return []
            
        h, w = frame.shape[:2]
        # YuNet requires active input size matching the frame
        self.detector.setInputSize((w, h))
        
        try:
            retval, faces = self.detector.detect(frame)
            if retval and faces is not None:
                # faces is a 2D numpy array where each row is a face
                result = []
                for face in faces:
                    x, y, w_box, h_box = map(int, face[0:4])
                    confidence = float(face[14])
                    landmarks = face[4:14].reshape(5, 2).astype(int) # right eye, left eye, nose, right mouth, left mouth
                    result.append({
                        "box": [max(0, x), max(0, y), w_box, h_box],
                        "confidence": confidence,
                        "landmarks": landmarks,
                        "raw_face": face # Keep raw row for alignment
                    })
                return result
        except Exception as e:
            print(f"Error during face detection: {e}")
        return []

    def get_aligned_face(self, frame, raw_face):
        """Aligns and crops the face image using SFace model."""
        if self.recognizer is None:
            self.initialize_models()
        if self.recognizer is None:
            return None
        try:
            aligned_face = self.recognizer.alignCrop(frame, raw_face)
            return aligned_face
        except Exception as e:
            print(f"Face alignment failed: {e}")
            return None

    def get_embedding(self, aligned_face):
        """Generates a 128-dimensional embedding vector for an aligned face."""
        if self.recognizer is None:
            self.initialize_models()
        if self.recognizer is None:
            return None
        try:
            # SFace expects BGR aligned image (112x112 default crop)
            embedding = self.recognizer.feature(aligned_face)
            # Normalize embedding
            # embedding = cv2.normalize(embedding, None)
            return embedding[0] # Returns 1D array of 128 elements
        except Exception as e:
            print(f"Embedding extraction failed: {e}")
            return None

    def compute_similarity(self, embedding1, embedding2):
        """Computes Cosine Similarity between two 128-D SFace embeddings.
        Values range from -1 to 1. Higher is more similar.
        SFace official match returns cosine similarity directly.
        """
        if self.recognizer is None:
            self.initialize_models()
        if self.recognizer is None:
                # Fallback cosine similarity
                dot_product = np.dot(embedding1, embedding2)
                norm1 = np.linalg.norm(embedding1)
                norm2 = np.linalg.norm(embedding2)
                return float(dot_product / (norm1 * norm2 + 1e-10))
                
        try:
            # Reshape to 2D row vectors for the SFace match method
            e1 = np.expand_dims(embedding1, axis=0)
            e2 = np.expand_dims(embedding2, axis=0)
            score = self.recognizer.match(e1, e2, cv2.FaceRecognizerSF_FR_COSINE)
            return float(score)
        except Exception as e:
            print(f"Error matching embeddings: {e}")
            # Fallback
            dot_product = np.dot(embedding1, embedding2)
            norm1 = np.linalg.norm(embedding1)
            norm2 = np.linalg.norm(embedding2)
            return float(dot_product / (norm1 * norm2 + 1e-10))

    def evaluate_quality(self, face_box, landmarks, frame_shape):
        """Evaluate the quality of a detected face.
        Check centeredness, bounding box size relative to typical sizes, and lighting.
        """
        x, y, w_box, h_box = face_box
        fh, fw = frame_shape[:2]
        
        # Center check (face center vs image center)
        face_cx = x + w_box / 2
        face_cy = y + h_box / 2
        image_cx = fw / 2
        image_cy = fh / 2
        
        dist_from_center = np.sqrt((face_cx - image_cx)**2 + (face_cy - image_cy)**2)
        norm_dist = dist_from_center / np.sqrt(fw**2 + fh**2)
        
        is_centered = norm_dist < 0.25
        
        # Size verify
        is_good_size = (w_box >= 60) and (h_box >= 60)
        
        # Calculate average alignment confidence based on eyeballs standard distance
        eye_distance = np.linalg.norm(landmarks[0] - landmarks[1])
        is_good_alignment = eye_distance > 15
        
        quality_score = 1.0 - min(0.5, norm_dist)
        if not is_good_size:
            quality_score *= 0.5
        
        return {
            "centered": is_centered,
            "good_size": is_good_size,
            "good_alignment": is_good_alignment,
            "quality_score": quality_score
        }
