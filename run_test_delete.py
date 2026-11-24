import sys
import os
sys.path.append(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'backend'))

from app import create_app
from database.db import db
from database.models import Person

app, _ = create_app()
with app.app_context():
    person = Person.query.filter_by(person_id='test1').first()
    if not person:
        print("Profile 'test1' not found, fetching first registered person...")
        person = Person.query.first()
        
    if person:
        print(f"Attempting to delete profile: {person.name} ({person.person_id})...")
        try:
            # Let's import the route function directly or call the session delete
            # Let's simulate the API delete_person logic
            
            # 1. Delete files from disk first
            from pathlib import Path
            from config import Config
            person_dir = Path(Config.DATASETS_DIR) / person.person_id
            print(f"Dataset path: {person_dir} (exists: {person_dir.exists()})")
            
            if person_dir.exists():
                for root, dirs, files in os.walk(str(person_dir), topdown=False):
                    for name in files:
                        file_path = os.path.join(root, name)
                        print(f"Removing file: {file_path}")
                        os.chmod(file_path, 0o777)
                        os.remove(file_path)
                    for name in dirs:
                        dir_path = os.path.join(root, name)
                        print(f"Removing dir: {dir_path}")
                        os.rmdir(dir_path)
                os.rmdir(str(person_dir))
                print("Directory removed from disk.")
                
            # 2. Database models delete
            from database.models import DetectionHistory, Alert
            DetectionHistory.query.filter_by(person_id=person.person_id).delete(synchronize_session=False)
            DetectionHistory.query.filter_by(name=person.name).delete(synchronize_session=False)
            
            from sqlalchemy import or_
            alert_pattern = f"%{person.person_id}%"
            name_pattern = f"%{person.name}%"
            Alert.query.filter(
                or_(
                    getattr(Alert, 'details').like(alert_pattern),
                    getattr(Alert, 'details').like(name_pattern)
                )
            ).delete(synchronize_session=False)
            
            db.session.delete(person)
            db.session.commit()
            print("Successfully deleted person from database!")
        except Exception as e:
            import traceback
            traceback.print_exc()
            db.session.rollback()
    else:
        print("No registered persons found in database to delete.")
