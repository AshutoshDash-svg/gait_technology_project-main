from datetime import datetime, timezone
from database.db import db

def utcnow_naive():
    return datetime.now(timezone.utc).replace(tzinfo=None)

class Person(db.Model):
    __tablename__ = 'persons'
    
    id = db.Column(db.Integer, primary_key=True)
    person_id = db.Column(db.String(50), unique=True, nullable=False, index=True)
    name = db.Column(db.String(100), nullable=False)
    created_at = db.Column(db.DateTime, default=utcnow_naive)
    
    # Relationships
    face_samples = db.relationship('FaceSample', backref='person', lazy=True, cascade="all, delete-orphan")
    gait_videos = db.relationship('GaitVideo', backref='person', lazy=True, cascade="all, delete-orphan")
    gait_features = db.relationship('GaitFeature', backref='person', lazy=True, cascade="all, delete-orphan")

    def __init__(self, person_id, name, created_at=None):
        self.person_id = person_id
        self.name = name
        if created_at is not None:
            self.created_at = created_at

    def to_dict(self):
        return {
            "id": self.id,
            "person_id": self.person_id,
            "name": self.name,
            "created_at": self.created_at.isoformat(),
            "face_samples_count": len(getattr(self, 'face_samples')),
            "gait_videos_count": len(getattr(self, 'gait_videos')),
            "gait_features_count": len(getattr(self, 'gait_features'))
        }

class FaceSample(db.Model):
    __tablename__ = 'face_samples'
    
    id = db.Column(db.Integer, primary_key=True)
    person_id = db.Column(db.String(50), db.ForeignKey('persons.person_id'), nullable=False)
    file_path = db.Column(db.String(255), nullable=False)
    embedding_path = db.Column(db.String(255), nullable=True)
    is_masked = db.Column(db.Boolean, default=False)
    is_aligned = db.Column(db.Boolean, default=False)
    quality_score = db.Column(db.Float, default=1.0)
    created_at = db.Column(db.DateTime, default=utcnow_naive)

    def __init__(self, person_id, file_path, embedding_path=None, is_masked=False, is_aligned=False, quality_score=1.0, created_at=None):
        self.person_id = person_id
        self.file_path = file_path
        self.embedding_path = embedding_path
        self.is_masked = is_masked
        self.is_aligned = is_aligned
        self.quality_score = quality_score
        if created_at is not None:
            self.created_at = created_at

    def to_dict(self):
        return {
            "id": self.id,
            "person_id": self.person_id,
            "file_path": self.file_path,
            "embedding_path": self.embedding_path,
            "is_masked": self.is_masked,
            "is_aligned": self.is_aligned,
            "quality_score": self.quality_score,
            "created_at": self.created_at.isoformat()
        }

class GaitVideo(db.Model):
    __tablename__ = 'gait_videos'
    
    id = db.Column(db.Integer, primary_key=True)
    person_id = db.Column(db.String(50), db.ForeignKey('persons.person_id'), nullable=False)
    file_path = db.Column(db.String(255), nullable=False)
    video_name = db.Column(db.String(100), nullable=False)
    created_at = db.Column(db.DateTime, default=utcnow_naive)
    
    features = db.relationship('GaitFeature', backref='gait_video', lazy=True, cascade="all, delete-orphan")

    def __init__(self, person_id, file_path, video_name, created_at=None):
        self.person_id = person_id
        self.file_path = file_path
        self.video_name = video_name
        if created_at is not None:
            self.created_at = created_at

    def to_dict(self):
        return {
            "id": self.id,
            "person_id": self.person_id,
            "file_path": self.file_path,
            "video_name": self.video_name,
            "created_at": self.created_at.isoformat(),
            "extracted_features_count": len(getattr(self, 'features'))
        }

class GaitFeature(db.Model):
    __tablename__ = 'gait_features'
    
    id = db.Column(db.Integer, primary_key=True)
    person_id = db.Column(db.String(50), db.ForeignKey('persons.person_id'), nullable=False)
    video_id = db.Column(db.Integer, db.ForeignKey('gait_videos.id'), nullable=True)
    feature_path = db.Column(db.String(255), nullable=False)
    sequence_length = db.Column(db.Integer, nullable=False)
    created_at = db.Column(db.DateTime, default=utcnow_naive)

    def __init__(self, person_id, feature_path, sequence_length, video_id=None, created_at=None):
        self.person_id = person_id
        self.feature_path = feature_path
        self.sequence_length = sequence_length
        self.video_id = video_id
        if created_at is not None:
            self.created_at = created_at

    def to_dict(self):
        return {
            "id": self.id,
            "person_id": self.person_id,
            "video_id": self.video_id,
            "feature_path": self.feature_path,
            "sequence_length": self.sequence_length,
            "created_at": self.created_at.isoformat()
        }

class DetectionHistory(db.Model):
    __tablename__ = 'detection_history'
    
    id = db.Column(db.Integer, primary_key=True)
    timestamp = db.Column(db.DateTime, default=utcnow_naive, index=True)
    camera = db.Column(db.String(100), default="Camera 01")
    track_id = db.Column(db.Integer, nullable=False)
    person_id = db.Column(db.String(50), nullable=True)
    name = db.Column(db.String(100), default="Unknown")
    method = db.Column(db.String(50), default="none")
    face_similarity = db.Column(db.Float, nullable=True)
    gait_confidence = db.Column(db.Float, nullable=True)
    status = db.Column(db.String(50), default="unknown")

    def __init__(self, track_id, camera="Camera 01", person_id=None, name="Unknown", method="none", face_similarity=None, gait_confidence=None, status="unknown", timestamp=None):
        self.track_id = track_id
        self.camera = camera
        self.person_id = person_id
        self.name = name
        self.method = method
        self.face_similarity = face_similarity
        self.gait_confidence = gait_confidence
        self.status = status
        if timestamp is not None:
            self.timestamp = timestamp

    def to_dict(self):
        return {
            "id": self.id,
            "timestamp": self.timestamp.isoformat(),
            "camera": self.camera,
            "track_id": self.track_id,
            "person_id": self.person_id,
            "name": self.name,
            "method": self.method,
            "face_similarity": self.face_similarity,
            "gait_confidence": self.gait_confidence,
            "status": self.status
        }

class Alert(db.Model):
    __tablename__ = 'alerts'
    
    id = db.Column(db.Integer, primary_key=True)
    timestamp = db.Column(db.DateTime, default=utcnow_naive, index=True)
    camera = db.Column(db.String(100), default="Camera 01")
    track_id = db.Column(db.Integer, nullable=False)
    details = db.Column(db.Text, nullable=False)
    is_resolved = db.Column(db.Boolean, default=False)

    def __init__(self, track_id, details, camera="Camera 01", is_resolved=False, timestamp=None):
        self.track_id = track_id
        self.details = details
        self.camera = camera
        self.is_resolved = is_resolved
        if timestamp is not None:
            self.timestamp = timestamp

    def to_dict(self):
        return {
            "id": self.id,
            "timestamp": self.timestamp.isoformat(),
            "camera": self.camera,
            "track_id": self.track_id,
            "details": self.details,
            "is_resolved": self.is_resolved
        }
