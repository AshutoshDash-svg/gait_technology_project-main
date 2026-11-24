from flask import Blueprint, request, jsonify, Response, current_app
from config import Config

surveillance_bp = Blueprint('surveillance', __name__)

@surveillance_bp.route('/api/surveillance/start', methods=['POST'])
def start_surveillance():
    """Starts the surveillance pipeline."""
    detection_svc = getattr(current_app, 'detection_service', None)
    if not detection_svc:
        return jsonify({"success": False, "error": "Detection service not initialized"}), 500
        
    data = request.json or {}
    # camera source can be an integer index (webcam) or a path to a demo video file
    source = data.get('source', 0)
    
    # Try converting source to int if possible (for webcam index)
    try:
        source = int(source)
    except (ValueError, TypeError):
        # Otherwise, treat as absolute path/string
        if not source:
            source = Config.DEFAULT_CAMERA_SRC
            
    success = detection_svc.start_surveillance(source)
    if success:
        return jsonify({
            "success": True, 
            "message": f"Surveillance stream started on source {source}.",
            "status": {
                "is_running": True,
                "source": source
            }
        })
    else:
        return jsonify({"success": False, "error": f"Failed to open surveillance source {source}"}), 400

@surveillance_bp.route('/api/surveillance/stop', methods=['POST'])
def stop_surveillance():
    """Stops the active surveillance loop."""
    detection_svc = getattr(current_app, 'detection_service', None)
    if not detection_svc:
        return jsonify({"success": False, "error": "Detection service not initialized"}), 500
        
    detection_svc.stop_surveillance()
    return jsonify({
        "success": True,
        "message": "Surveillance stream has been stopped.",
        "status": {
            "is_running": False
        }
    })

@surveillance_bp.route('/api/surveillance/status', methods=['GET'])
def get_surveillance_status():
    """Get active state of the surveillance stream."""
    detection_svc = getattr(current_app, 'detection_service', None)
    if not detection_svc:
        return jsonify({"success": False, "error": "Detection service not initialized"}), 500
        
    active_tracks = {
        str(tid): tval.get("last_result") 
        for tid, tval in detection_svc.tracks.items() 
        if tval.get("last_result") is not None
    }
    
    return jsonify({
        "success": True,
        "data": {
            "is_running": detection_svc.is_running,
            "source": detection_svc.camera_src,
            "active_tracks_count": len(detection_svc.tracks),
            "active_tracks": active_tracks,
            "face_threshold": detection_svc.decision_engine.face_threshold,
            "gait_threshold": detection_svc.decision_engine.gait_threshold
        }
    })

@surveillance_bp.route('/api/surveillance/settings', methods=['POST'])
def update_surveillance_settings():
    """Change recognition decision thresholds dynamically."""
    detection_svc = getattr(current_app, 'detection_service', None)
    if not detection_svc:
        return jsonify({"success": False, "error": "Detection service not initialized"}), 500
        
    data = request.json or {}
    face_thresh = data.get('face_threshold')
    gait_thresh = data.get('gait_threshold')
    
    if face_thresh is not None:
        try:
            face_val = float(face_thresh)
            detection_svc.decision_engine.face_threshold = face_val
            detection_svc.face_service.face_threshold = face_val
        except ValueError:
            return jsonify({"success": False, "error": "Face threshold must be a float number"}), 400
            
    if gait_thresh is not None:
        try:
            gait_val = float(gait_thresh)
            detection_svc.decision_engine.gait_threshold = gait_val
            detection_svc.gait_service.gait_threshold = gait_val
        except ValueError:
            return jsonify({"success": False, "error": "Gait threshold must be a float number"}), 400
            
    return jsonify({
        "success": True,
        "message": "Recognition settings updated successfully.",
        "data": {
            "face_threshold": detection_svc.decision_engine.face_threshold,
            "gait_threshold": detection_svc.decision_engine.gait_threshold
        }
    })

@surveillance_bp.route('/api/surveillance/video_feed')
def video_feed():
    """MJPEG stream endpoint that delivers frames to frontend HTML tags."""
    detection_svc = getattr(current_app, 'detection_service', None)
    if not detection_svc or not detection_svc.is_running:
        # Return fallback black image or error if surveillance not running
        import cv2
        import numpy as np
        img = np.zeros((480, 640, 3), np.uint8)
        cv2.putText(img, "CCTV OFFLINE", (170, 250), cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2)
        cv2.putText(img, "Start surveillance via dashboard", (100, 290), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (200, 200, 200), 1)
        r, buf = cv2.imencode('.jpg', img)
        return Response(buf.tobytes(), mimetype='image/jpeg')
        
    # Return generator sequence as MJPEG
    return Response(
        detection_svc.generate_frames(),
        mimetype='multipart/x-mixed-replace; boundary=frame'
    )
