import os
import sys
import cv2

# Add backend to Python system path for resolution at runtime
backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "backend"))
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

# Try importing with package prefix for linter support, fallback to direct import
try:
    from backend.services.face_service import FaceService
except ImportError:
    from services.face_service import FaceService  # type: ignore

def test():
    face_svc = FaceService()
    
    img_dir = "backend/datasets/test1/faces"
    if not os.path.exists(img_dir):
        img_dir = "datasets/test1/faces"
        
    if not os.path.exists(img_dir):
        print(f"Dataset path not found: {img_dir}")
        return
        
    out_lines = []
    for fname in os.listdir(img_dir):
        if not fname.endswith(".jpg"):
            continue
        p = os.path.join(img_dir, fname)
        img = cv2.imread(p)
        if img is None:
            out_lines.append(f"Failed to load {p}")
            continue
        faces = face_svc.detect_faces(img)
        out_lines.append(f"File {fname}: detected {len(faces)} faces.")
        for i, f in enumerate(faces):
            out_lines.append(f"  Face {i}: box={f['box']}, confidence={f['confidence']:.4f}")
            
    print("\n".join(out_lines))
    
    with open("test_output_ascii.txt", "w", encoding="utf-8") as f:
        f.write("\n".join(out_lines))

if __name__ == '__main__':
    test()
