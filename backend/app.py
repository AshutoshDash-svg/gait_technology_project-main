import os
import sys
from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_socketio import SocketIO
import cv2
# Add current folder to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from config import Config
from database.db import db
from services.detection_service import DetectionService

# Import Blueprints
from routes.persons import persons_bp
from routes.features import features_bp
from routes.train_eval import train_eval_bp
from routes.surveillance import surveillance_bp
from routes.history_alerts import history_alerts_bp

def create_app():
    frontend_folder = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend", "dist"))
    app = Flask(__name__, static_folder=frontend_folder, static_url_path="")
    app.config.from_object(Config)
    
    # Enable CORS
    CORS(app, resources={r"/api/*": {"origins": "*"}})
    
    # Initialize DB
    db.init_app(app)
    
    # Initialize Socket.IO
    socketio = SocketIO(app, cors_allowed_origins="*", async_mode='gevent' if 'gevent' in sys.modules else 'threading')
    
    # Register blueprints
    app.register_blueprint(persons_bp)
    app.register_blueprint(features_bp)
    app.register_blueprint(train_eval_bp)
    app.register_blueprint(surveillance_bp)
    app.register_blueprint(history_alerts_bp)
    
    # Create DB tables
    with app.app_context():
        db.create_all()
        print("Database tables initialized.")
        
    # Initialize AI surveillance / tracking service
    setattr(app, 'detection_service', DetectionService(app, socketio))
    
    # Health check route
    @app.route('/api/health')
    def health():
        return jsonify({
            "success": True, 
            "status": "online",
            "message": "AI-Based Surveillance System backend is running.",
            "db_initialized": os.path.exists(app.config['SQLALCHEMY_DATABASE_URI'].replace('sqlite:///', ''))
        })
        
    @app.route("/", defaults={"path": ""})
    @app.route("/<path:path>")
    def serve_frontend(path):
        if path.startswith("api/") or path.startswith("api"):
            return jsonify({"success": False, "error": "Not Found"}), 404
        if path != "" and app.static_folder and os.path.exists(os.path.join(app.static_folder, path)):
            return app.send_static_file(path)
        else:
            return app.send_static_file("index.html")
            
    # 404 Error handler to serve index.html for undefined frontend routes (SPA refresh support)
    @app.errorhandler(404)
    def page_not_found(e):
        if request.path.startswith('/api/'):
            return jsonify({"success": False, "error": "Not Found"}), 404
        return app.send_static_file("index.html")
            
    return app, socketio

app, socketio = create_app()

if __name__ == '__main__':
    # Start web server
    port = int(os.environ.get("PORT", 5000))
    print(f"Starting Flask-SocketIO server on http://localhost:{port}")
    socketio.run(app, host='0.0.0.0', port=port, debug=True, allow_unsafe_werkzeug=True)
