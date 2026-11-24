from typing import TypedDict
from flask import Blueprint, request, jsonify
from sqlalchemy import desc, func

class TimeTrendEntry(TypedDict):
    time: str
    detections: int
    alerts: int

from database.db import db
from database.models import DetectionHistory, Alert, Person
from datetime import datetime, timedelta, timezone

history_alerts_bp = Blueprint('history_alerts', __name__)

@history_alerts_bp.route('/api/detections', methods=['GET'])
def get_detections():
    """Retrieve history logs, with adjustable search filters and sorting."""
    person_id = request.args.get('person_id')
    camera = request.args.get('camera')
    method = request.args.get('method')
    status = request.args.get('status')
    limit = request.args.get('limit', 100, type=int)
    offset = request.args.get('offset', 0, type=int)
    
    query = db.session.query(DetectionHistory)
    
    if person_id:
        query = query.filter_by(person_id=person_id)
    if camera:
        query = query.filter_by(camera=camera)
    if method:
        query = query.filter_by(method=method)
    if status:
        if status == 'IDENTIFIED':
            query = query.filter(getattr(DetectionHistory, 'status').like('IDENTIFIED%'))
        else:
            query = query.filter_by(status=status)
        
    query = query.order_by(desc(getattr(DetectionHistory, 'timestamp')))
    
    try:
        total = query.count()
        records = query.limit(limit).offset(offset).all()
        return jsonify({
            "success": True,
            "data": [r.to_dict() for r in records],
            "pagination": {
                "total": total,
                "limit": limit,
                "offset": offset
            }
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@history_alerts_bp.route('/api/alerts', methods=['GET'])
def get_alerts():
    """Retrieve system security alerts."""
    is_resolved = request.args.get('is_resolved')
    limit = request.args.get('limit', 50, type=int)
    
    query = db.session.query(Alert)
    
    if is_resolved is not None:
        resolved_bool = is_resolved.lower() in ['true', '1']
        query = query.filter_by(is_resolved=resolved_bool)
        
    query = query.order_by(desc(getattr(Alert, 'timestamp')))
    
    try:
        records = query.limit(limit).all()
        return jsonify({
            "success": True,
            "data": [r.to_dict() for r in records]
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@history_alerts_bp.route('/api/alerts/<int:alert_id>/resolve', methods=['POST'])
def resolve_alert(alert_id):
    """Marks an active unknown alert instance as acknowledged."""
    alert = db.session.get(Alert, alert_id)
    if not alert:
        return jsonify({"success": False, "error": "Alert not found"}), 404
        
    try:
        alert.is_resolved = True
        db.session.commit()
        return jsonify({"success": True, "message": f"Alert {alert_id} resolved successfully.", "data": alert.to_dict()})
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "error": str(e)}), 500

@history_alerts_bp.route('/api/analytics', methods=['GET'])
def get_analytics():
    """Compile aggregated real analytics summary statistics from SQL logs."""
    try:
        # 1. Standard Counts
        total_people = db.session.query(Person).count()
        total_detections = db.session.query(DetectionHistory).count()
        total_alerts = db.session.query(Alert).count()
        unresolved_alerts = db.session.query(Alert).filter_by(is_resolved=False).count()
        
        # 2. Method Splits (Face vs Gait vs None)
        methods = db.session.query(
            getattr(DetectionHistory, 'method'), func.count(getattr(DetectionHistory, 'id'))
        ).group_by(getattr(DetectionHistory, 'method')).all()
        
        method_split = []
        for m, count in methods:
            if m and m != "None":
                method_split.append({"name": m, "value": count})
                
        # 3. Known vs Unknown SPLIT
        known_count = db.session.query(DetectionHistory).filter(getattr(DetectionHistory, 'name') != "Unknown").count()
        unknown_count = db.session.query(DetectionHistory).filter_by(name="Unknown").count()
        
        recognition_split = [
            {"name": "Known Profiles", "value": known_count},
            {"name": "Unknown Alerts", "value": unknown_count}
        ]
        
        # 4. Hourly Trend (Detections over last 24 Hours)
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        day_ago = now - timedelta(hours=24)
        
        hourly_records = db.session.query(DetectionHistory).filter(
            getattr(DetectionHistory, 'timestamp') >= day_ago
        ).order_by(getattr(DetectionHistory, 'timestamp')).all()
        
        # Initialize 24-hour bins
        time_trend: dict[str, TimeTrendEntry] = {}
        for h in range(24):
            bin_time = now - timedelta(hours=h)
            time_str = bin_time.strftime("%H:00")
            time_trend[time_str] = {"time": time_str, "detections": 0, "alerts": 0}
            
        for r in hourly_records:
            t_str = r.timestamp.strftime("%H:00")
            if t_str in time_trend:
                time_trend[t_str]["detections"] += 1
                if r.status == "ALERT":
                    time_trend[t_str]["alerts"] += 1
                    
        sorted_trend = sorted(time_trend.values(), key=lambda x: datetime.strptime(x["time"], "%H:00"))
        
        # 5. Top Identified Persons Table
        top_ident = db.session.query(
            getattr(DetectionHistory, 'name'), func.count(getattr(DetectionHistory, 'id'))
        ).filter(getattr(DetectionHistory, 'name') != "Unknown").group_by(getattr(DetectionHistory, 'name')).order_by(desc(func.count(getattr(DetectionHistory, 'id')))).limit(5).all()
        
        top_people = [{"name": name, "count": count} for name, count in top_ident]
        
        return jsonify({
            "success": True,
            "data": {
                "counts": {
                    "total_people": total_people,
                    "total_detections": total_detections,
                    "total_alerts": total_alerts,
                    "unresolved_alerts": unresolved_alerts
                },
                "method_split": method_split,
                "recognition_split": recognition_split,
                "time_trend": sorted_trend,
                "top_people": top_people
            }
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500
