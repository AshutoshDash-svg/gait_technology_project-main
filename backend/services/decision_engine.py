import numpy as np
from config import Config

class DecisionEngine:
    def __init__(self, face_service, gait_service):
        self.face_service = face_service
        self.gait_service = gait_service
        
        # Load thresholds
        self.face_threshold = Config.FACE_SIMILARITY_THRESHOLD
        self.gait_threshold = Config.GAIT_CONFIDENCE_THRESHOLD

    def set_thresholds(self, face_thresh, gait_thresh):
        self.face_threshold = face_thresh
        self.gait_threshold = gait_thresh

    def fuse_identities(self, face_result, gait_result):
        """Fuses decisions from Face recognition and Gait recognition.
        
        Args:
            face_result: dict, e.g., {"person_id": "P001", "name": "Registered Person", "similarity": 0.85, "visible": True}
                         or {"person_id": None, "similarity": 0.0, "visible": False}
            gait_result: dict, e.g., {"person_id": "P001", "confidence": 0.78, "frames": 35}
                         or {"person_id": "Unknown", "confidence": 0.0, "frames": 0}
        
        Returns:
            dict with final fused identification metrics.
        """
        face_sim = face_result.get("similarity", 0.0)
        face_pid = face_result.get("person_id")
        face_name = face_result.get("name")
        face_visible = face_result.get("visible", False)
        face_quality = face_result.get("quality", 0.0)
        face_masked = face_result.get("is_masked", False)
        
        gait_conf = gait_result.get("confidence", 0.0)
        gait_pid = gait_result.get("person_id")
        gait_name = gait_result.get("name")
        gait_frames = gait_result.get("frames", 0)

        # Case 1: Strong face evidence
        if face_visible and face_pid and face_sim >= self.face_threshold and face_quality > 0.5:
            return {
                "person_id": face_pid,
                "name": face_name,
                "method": "Face Recognition",
                "confidence": face_sim,
                "status": "IDENTIFIED",
                "details": f"Face match ({face_sim:.2f})",
                "is_masked": face_masked
            }

        # Case 2: Face is unreliable (but visible/low-match or masked) or occluded, and we have enough gait evidence
        if (not face_visible or face_sim < self.face_threshold or face_masked) and gait_frames >= 20:
            if gait_pid and gait_pid != "Unknown" and gait_conf >= self.gait_threshold:
                return {
                    "person_id": gait_pid,
                    "name": gait_name,
                    "method": "Gait Recognition",
                    "confidence": gait_conf,
                    "status": "IDENTIFIED",
                    "details": f"Gait match ({gait_conf:.2f}), Face unreliable" + (" (Masked)" if face_masked else ""),
                    "is_masked": face_masked
                }

        # Case 3: Both face and gait results are available but below standard thresholds
        if (not face_visible or face_sim < self.face_threshold) and (gait_frames >= 20 and (gait_pid == "Unknown" or gait_conf < self.gait_threshold)):
            return {
                "person_id": "Unknown",
                "name": "Unknown",
                "method": "Multimodal (Rejected)",
                "confidence": max(face_sim, gait_conf),
                "status": "ALERT",
                "details": "Unknown - low face similarity and gait confidence",
                "is_masked": face_masked
            }

        # Case 4: Face is unavailable or unreliable, and gait still buffering
        if (not face_visible or face_sim < self.face_threshold or face_masked) and gait_frames < 20:
            return {
                "person_id": None,
                "name": "Buffering...",
                "method": "Gait Buffering",
                "confidence": float(gait_frames) / 20.0,
                "status": "PROCESSING",
                "details": f"Buffering gait data ({gait_frames}/20 frames)",
                "is_masked": face_masked
            }

        # Default fallback
        return {
            "person_id": "Unknown",
            "name": "Unknown",
            "method": "None",
            "confidence": 0.0,
            "status": "ALERT",
            "details": "Unknown person - insufficient biometric evidence",
            "is_masked": face_masked
        }
