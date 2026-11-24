import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import {
    UserPlus,
    Info,
    Camera,
    Play,
    Square,
    Video,
    CheckCircle2,
    XCircle,
    AlertCircle,
    UserCheck,
    RefreshCw,
    Sliders,
    ArrowRight
} from 'lucide-react';

const RegisterPerson = () => {
    // Stage controls: 'form' -> user inputs info; 'studio' -> camera enrollment active
    const [stage, setStage] = useState('form');

    // Configuration states
    const [personId, setPersonId] = useState('');
    const [name, setName] = useState('');
    const [targetFaceCount, setTargetFaceCount] = useState(5);
    const [targetGaitCount, setTargetGaitCount] = useState(3);

    // Camera video & recording refs
    const videoRef = useRef(null);
    const streamRef = useRef(null);
    const mediaRecorderRef = useRef(null);
    const recordedChunksRef = useRef([]);

    // Enrollment logs & feedback
    const [feedback, setFeedback] = useState({ success: null, message: '' });
    const [studioLogs, setStudioLogs] = useState([]);
    const [isCameraActive, setIsCameraActive] = useState(false);
    const [cameraError, setCameraError] = useState('');

    // Capture & Recording states
    const [isRecordingGait, setIsRecordingGait] = useState(false);
    const [recordingSeconds, setRecordingSeconds] = useState(0);
    const [isVerifyingFace, setIsVerifyingFace] = useState(false);
    const [isUploadingGait, setIsUploadingGait] = useState(false);

    // List of uploaded assets
    const [faceSamples, setFaceSamples] = useState([]);
    const [gaitVideos, setGaitVideos] = useState([]);

    const logToStudio = (msg, type = 'info') => {
        const timestamp = new Date().toLocaleTimeString();
        setStudioLogs(prev => [...prev, { timestamp, msg, type }]);
    };

    // Keep recording duration updated
    useEffect(() => {
        let interval = null;
        if (isRecordingGait) {
            interval = setInterval(() => {
                setRecordingSeconds(prev => prev + 1);
            }, 1000);
        } else {
            setRecordingSeconds(0);
        }
        return () => clearInterval(interval);
    }, [isRecordingGait]);

    // Handle initial registration details submit and open studio
    const handleInitEnrollment = async (e) => {
        e.preventDefault();
        if (!personId.trim() || !name.trim()) {
            setFeedback({ success: false, message: "Profile ID and Full Name are required." });
            return;
        }

        setFeedback({ success: null, message: '' });
        setStudioLogs([]);

        try {
            // Attempt to create person profile first
            const res = await api.post('/persons', {
                person_id: personId.trim().toLowerCase(),
                name: name.trim()
            });

            if (res.data.success) {
                setFaceSamples([]);
                setGaitVideos([]);
                logToStudio(`Biometric profile created for: ${name} (${personId})`);
            }
        } catch (err) {
            // If user already exists, retrieve target details instead of throwing
            const errMsg = err.response?.data?.error || '';
            if (errMsg.includes("already exists")) {
                try {
                    const getRes = await api.get(`/persons/${personId.trim().toLowerCase()}`);
                    if (getRes.data.success) {
                        const data = getRes.data.data;
                        setFaceSamples(data.face_samples || []);
                        setGaitVideos(data.gait_samples || []);
                        logToStudio(`Existing biometric profile loaded: ${data.name} (${personId})`);
                    }
                } catch (readErr) {
                    setFeedback({ success: false, message: "Identity ID already matches another profile and details could not be loaded." });
                    return;
                }
            } else {
                setFeedback({ success: false, message: errMsg || "Failed to initialize person profile." });
                return;
            }
        }

        // Proceed to studio stage
        setStage('studio');
        setTimeout(() => startCamera(), 100);
    };

    // Open Webcam helper
    const startCamera = async () => {
        setCameraError('');
        try {
            const constraints = {
                video: { width: 640, height: 480, facingMode: "user" },
                audio: false
            };
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
            setIsCameraActive(true);
            logToStudio("Browser camera stream initialized (640x480 resolution). Ready for capture.");
        } catch (err) {
            console.error("Camera access failed", err);
            setCameraError("Camera access denied or device occupies by other software. Please check permissions.");
            logToStudio("Failed to request WebRTC getUserMedia permissions.", "error");
        }
    };

    // Close Webcam helper
    const stopCamera = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
        setIsCameraActive(false);
        logToStudio("Camera feeds stopped.");
    };

    // Stop camera stream on page unmount
    useEffect(() => {
        return () => {
            stopCamera();
        };
    }, []);

    // capture single face instance, submit to backend for validation via YuNet
    const handleCaptureFace = async () => {
        if (!isCameraActive || !videoRef.current || isVerifyingFace) return;

        setIsVerifyingFace(true);
        logToStudio("Capturing live face frame stream...");

        try {
            const video = videoRef.current;
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth || 640;
            canvas.height = video.videoHeight || 480;

            const ctx = canvas.getContext('2d');
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

            // Convert canvas output to blob
            canvas.toBlob(async (blob) => {
                if (!blob) {
                    logToStudio("Could not extract canvas frame bytes.", "error");
                    setIsVerifyingFace(false);
                    return;
                }

                const formData = new FormData();
                formData.append('file', blob, 'webcam_face.jpg');

                try {
                    logToStudio("Sending image to YuNet face validation engine...");
                    const res = await api.post(`/persons/${personId.toLowerCase()}/enroll-face`, formData, {
                        headers: { 'Content-Type': 'multipart/form-data' }
                    });

                    if (res.data.success) {
                        const newSample = res.data.data;
                        setFaceSamples(prev => [...prev, newSample]);
                        logToStudio(`Face snapshot qualified & saved. filename: ${newSample.file_path.split('\\').pop()}`, "success");
                    }
                } catch (postErr) {
                    const failMsg = postErr.response?.data?.error || "Face verification failed.";
                    logToStudio(`Face Verification Failed: ${failMsg}`, "error");
                } finally {
                    setIsVerifyingFace(false);
                }
            }, 'image/jpeg', 0.95);

        } catch (err) {
            logToStudio(`Capture Exception: ${err.message}`, "error");
            setIsVerifyingFace(false);
        }
    };

    // media recorder gait recordings capture
    const handleStartGaitRecord = () => {
        if (!isCameraActive || !streamRef.current || isRecordingGait) return;

        recordedChunksRef.current = [];
        let options = { mimeType: 'video/webm;codecs=vp8' };
        if (!MediaRecorder.isTypeSupported(options.mimeType)) {
            options = { mimeType: 'video/mp4' };
        }

        try {
            const recorder = new MediaRecorder(streamRef.current, options);
            recorder.ondataavailable = (event) => {
                if (event.data && event.data.size > 0) {
                    recordedChunksRef.current.push(event.data);
                }
            };

            recorder.onstop = async () => {
                setIsUploadingGait(true);
                logToStudio("Walk recording complete. Compiling gait raw streams...");

                const blob = new Blob(recordedChunksRef.current, { type: options.mimeType });
                const ext = options.mimeType.includes('mp4') ? '.mp4' : '.webm';
                const file = new File([blob], `gait_walk${ext}`, { type: options.mimeType });

                const formData = new FormData();
                formData.append('file', file);

                try {
                    logToStudio("Uploading raw sequence to the person dataset catalog...");
                    const uploadRes = await api.post(`/persons/${personId.toLowerCase()}/enroll-gait`, formData, {
                        headers: { 'Content-Type': 'multipart/form-data' }
                    });

                    if (uploadRes.data.success) {
                        const newGait = uploadRes.data.data;
                        setGaitVideos(prev => [...prev, newGait]);
                        logToStudio(`Walking video enrolled: ${newGait.video_name}`, "success");
                    }
                } catch (uploadErr) {
                    const failMsg = uploadErr.response?.data?.error || "Walking sequence upload failed.";
                    logToStudio(`Gait sequence upload failed: ${failMsg}`, "error");
                } finally {
                    setIsUploadingGait(false);
                }
            };

            mediaRecorderRef.current = recorder;
            recorder.start();
            setIsRecordingGait(true);
            logToStudio("Recording walking dynamics sequence... Stand back and walk naturally.");
        } catch (err) {
            logToStudio(`MediaRecorder creation failed: ${err.message}`, "error");
        }
    };

    const handleStopGaitRecord = () => {
        if (mediaRecorderRef.current && isRecordingGait) {
            mediaRecorderRef.current.stop();
            setIsRecordingGait(false);
            logToStudio("Walk recording stream closed.");
        }
    };

    const handleCloseStudio = () => {
        stopCamera();
        setStage('form');
        setPersonId('');
        setName('');
    };

    return (
        <div className="p-8 max-w-6xl mx-auto space-y-6 animate-fadeIn">
            {/* Header */}
            <div className="border-b border-neutral-800 pb-5">
                <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                    <UserPlus className="text-indigo-500" />
                    <span>Real-Time Profile Registry Studio</span>
                </h2>
                <p className="text-neutral-400 text-xs mt-1">
                    Transition from demo models to custom biometrics. Capture live faces verified by YuNet and record gait walk videos.
                </p>
            </div>

            {feedback.message && stage === 'form' && (
                <div className={`p-4 rounded-xl border flex items-center gap-3 text-xs font-semibold ${feedback.success ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300' : 'bg-rose-500/10 border-rose-500/20 text-rose-300'
                    }`}>
                    {feedback.success ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                    <span>{feedback.message}</span>
                </div>
            )}

            {stage === 'form' ? (
                <form onSubmit={handleInitEnrollment} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Setup Parameters Panel */}
                    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 space-y-4">
                        <h3 className="text-sm font-bold text-white uppercase tracking-wider border-b border-neutral-800 pb-2 flex items-center gap-2">
                            <Info size={14} className="text-indigo-400" />
                            <span>Identity Profile Details</span>
                        </h3>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-[11px] font-semibold text-neutral-400 uppercase mb-1.5">Profile Unique ID</label>
                                <input
                                    type="text"
                                    required
                                    value={personId}
                                    onChange={(e) => setPersonId(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''))}
                                    placeholder="e.g. rahul or P01"
                                    className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-850 rounded-xl text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-indigo-650"
                                />
                                <p className="text-[10px] text-neutral-500 mt-1">
                                    Acts as the folder name under datasets/ (lowercase, no spaces).
                                </p>
                            </div>

                            <div>
                                <label className="block text-[11px] font-semibold text-neutral-400 uppercase mb-1.5">Full Name</label>
                                <input
                                    type="text"
                                    required
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="e.g. Rahul Sharma"
                                    className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-850 rounded-xl text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-indigo-650"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Target Configuration Panel */}
                    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 flex flex-col justify-between space-y-4">
                        <div className="space-y-4">
                            <h3 className="text-sm font-bold text-white uppercase tracking-wider border-b border-neutral-800 pb-2 flex items-center gap-2">
                                <Sliders size={14} className="text-indigo-400" />
                                <span>Targets Controls</span>
                            </h3>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[11px] font-semibold text-neutral-400 uppercase mb-1.5">Target Face Pictures</label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="30"
                                        value={targetFaceCount}
                                        onChange={(e) => setTargetFaceCount(parseInt(e.target.value) || 5)}
                                        className="w-full px-3.5 py-2 bg-neutral-950 border border-neutral-850 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-650"
                                    />
                                    <p className="text-[9px] text-neutral-500 mt-1">Recommended: 5 or more</p>
                                </div>
                                <div>
                                    <label className="block text-[11px] font-semibold text-neutral-400 uppercase mb-1.5">Target Gait Videos</label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="10"
                                        value={targetGaitCount}
                                        onChange={(e) => setTargetGaitCount(parseInt(e.target.value) || 3)}
                                        className="w-full px-3.5 py-2 bg-neutral-950 border border-neutral-850 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-650"
                                    />
                                    <p className="text-[9px] text-neutral-500 mt-1">Recommended: 3 or more</p>
                                </div>
                            </div>
                        </div>

                        <button
                            type="submit"
                            className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-650/15 transition flex items-center justify-center gap-1.5"
                        >
                            <span>Open Camera Studio</span>
                            <ArrowRight size={14} />
                        </button>
                    </div>
                </form>
            ) : (
                /* Stage 'studio' - Camera enrollment studio */
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                    {/* Camera Feed Left Panel (Spans 2 cols) */}
                    <div className="lg:col-span-2 space-y-4">
                        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 overflow-hidden relative">
                            {/* Live Video element container with glowing outlines */}
                            <div className={`aspect-video rounded-xl overflow-hidden bg-neutral-950 flex items-center justify-center border border-neutral-850 relative ${isRecordingGait ? 'ring-2 ring-rose-500 ring-offset-2 ring-offset-neutral-900' : ''
                                }`}>
                                <video
                                    ref={videoRef}
                                    autoPlay
                                    playsInline
                                    muted
                                    className="w-full h-full object-cover"
                                    style={{ transform: "scaleX(-1)" }} // Mirror horizontal preview for user ease
                                />

                                {/* Camera overlay tags / indicators */}
                                {isCameraActive && (
                                    <div className="absolute top-4 left-4 bg-neutral-900/90 border border-neutral-800 text-[10px] text-white px-2.5 py-1 rounded font-mono font-bold flex items-center gap-1.5 backdrop-blur-md">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                        LIVE PORTRAIT CAMERA
                                    </div>
                                )}

                                {isRecordingGait && (
                                    <div className="absolute top-4 right-4 bg-rose-500 border border-rose-600 text-[10px] text-white px-2.5 py-1 rounded font-mono font-medium flex items-center gap-1.5 animate-pulse shadow-md">
                                        <span className="w-2.5 h-2.5 bg-white rounded-full"></span>
                                        <span>RECORDING ({recordingSeconds}s)</span>
                                    </div>
                                )}

                                {isVerifyingFace && (
                                    <div className="absolute inset-0 bg-neutral-950/60 backdrop-blur-sm flex flex-col items-center justify-center space-y-2 text-xs font-semibold text-white animate-fadeIn">
                                        <RefreshCw size={24} className="animate-spin text-indigo-400" />
                                        <span>YuNet Aligning Face...</span>
                                    </div>
                                )}

                                {isUploadingGait && (
                                    <div className="absolute inset-0 bg-neutral-950/60 backdrop-blur-sm flex flex-col items-center justify-center space-y-2 text-xs font-semibold text-white animate-fadeIn">
                                        <RefreshCw size={24} className="animate-spin text-indigo-400" />
                                        <span>Uploading walk sequence video file...</span>
                                    </div>
                                )}

                                {cameraError && (
                                    <div className="p-8 text-center max-w-sm space-y-3">
                                        <AlertCircle size={32} className="text-rose-500 mx-auto" />
                                        <p className="text-white text-xs font-bold">{cameraError}</p>
                                        <button
                                            onClick={startCamera}
                                            className="px-4 py-1.5 bg-neutral-905 border border-neutral-800 hover:bg-neutral-850 rounded text-[11px]"
                                        >
                                            Retry Permissions
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Camera Actions Bar */}
                            <div className="flex gap-4 mt-4">
                                <button
                                    type="button"
                                    onClick={handleCaptureFace}
                                    disabled={!isCameraActive || isVerifyingFace || isRecordingGait}
                                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-indigo-650/10"
                                >
                                    <Camera size={14} />
                                    <span>Capture Face Sample ({faceSamples.length}/{targetFaceCount})</span>
                                </button>

                                {!isRecordingGait ? (
                                    <button
                                        type="button"
                                        onClick={handleStartGaitRecord}
                                        disabled={!isCameraActive || isVerifyingFace || isUploadingGait}
                                        className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold bg-emerald-650 hover:bg-emerald-600 text-white disabled:opacity-40 disabled:cursor-not-allowed shadow-md"
                                    >
                                        <Play size={14} />
                                        <span>Record Walking Sequence</span>
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={handleStopGaitRecord}
                                        className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-md animate-pulse"
                                    >
                                        <Square size={14} />
                                        <span>Stop & Upload gait ({gaitVideos.length}/{targetGaitCount})</span>
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Walking Instructions Card */}
                        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 space-y-2">
                            <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider">GAIT ENROLLMENT INSTRUCTIONS:</h4>
                            <ul className="text-[10px] text-neutral-400 space-y-1 list-disc pl-4 leading-relaxed">
                                <li>Stand at the starting position (at least 3-4 meters away from the lens).</li>
                                <li>Click <strong>Record Walking Sequence</strong>, then walk naturally through the camera's full field of view.</li>
                                <li>Maintain a normal walking speed. When done, click <strong>Stop & Upload gait</strong>.</li>
                                <li>Capture multiple angles or speed profiles to assist the SVM body dynamics classifiers.</li>
                            </ul>
                        </div>
                    </div>

                    {/* Progress details Right Panel (Spans 1 col) */}
                    <div className="lg:col-span-1 space-y-4 flex flex-col">

                        {/* Profile Info Summary */}
                        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 space-y-3">
                            <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider border-b border-neutral-800 pb-1.5">
                                Active Profile
                            </h3>
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold">
                                    {name.charAt(0).toUpperCase()}
                                </div>
                                <div className="space-y-0.5">
                                    <p className="text-xs font-bold text-white leading-none">{name}</p>
                                    <p className="text-[10px] text-neutral-500 leading-none">Folder ID: datasets/{personId}</p>
                                </div>
                            </div>
                        </div>

                        {/* Targets Progress Panel */}
                        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 space-y-4">
                            <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider border-b border-neutral-800 pb-1.5">
                                Targets Progress
                            </h3>

                            {/* Face Progress */}
                            <div className="space-y-1 text-xs">
                                <div className="flex justify-between items-center text-[10px]">
                                    <span className="text-neutral-400 font-semibold">Face Images:</span>
                                    <span className={`font-mono font-bold ${faceSamples.length >= targetFaceCount ? 'text-emerald-400' : 'text-amber-450'}`}>
                                        {faceSamples.length} / {targetFaceCount}
                                    </span>
                                </div>
                                <div className="w-full h-1.5 bg-neutral-950 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-indigo-500 rounded-full transition-all duration-200"
                                        style={{ width: `${Math.min(100, (faceSamples.length / targetFaceCount) * 100)}%` }}
                                    ></div>
                                </div>
                            </div>

                            {/* Gait Progress */}
                            <div className="space-y-1 text-xs">
                                <div className="flex justify-between items-center text-[10px]">
                                    <span className="text-neutral-400 font-semibold">Gait Sequences:</span>
                                    <span className={`font-mono font-bold ${gaitVideos.length >= targetGaitCount ? 'text-emerald-400' : 'text-amber-450'}`}>
                                        {gaitVideos.length} / {targetGaitCount}
                                    </span>
                                </div>
                                <div className="w-full h-1.5 bg-neutral-950 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-emerald-500 rounded-full transition-all duration-200"
                                        style={{ width: `${Math.min(100, (gaitVideos.length / targetGaitCount) * 100)}%` }}
                                    ></div>
                                </div>
                            </div>
                        </div>

                        {/* Logs Terminal console */}
                        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 flex flex-col flex-1">
                            <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider border-b border-neutral-800 pb-2">
                                Enrollment Studio Logs
                            </h3>
                            <div className="flex-1 mt-2.5 h-[160px] max-h-[220px] overflow-y-auto bg-neutral-950/70 border border-neutral-850 p-3 rounded-xl font-mono text-[9px] text-neutral-300 space-y-1 scroll-smooth">
                                {studioLogs.length > 0 ? (
                                    studioLogs.map((log, i) => (
                                        <div key={i} className="leading-snug">
                                            <span className="text-neutral-600">[{log.timestamp}]</span>{' '}
                                            {log.type === 'error' && <span className="text-rose-450 font-bold">{log.msg}</span>}
                                            {log.type === 'success' && <span className="text-emerald-450 font-bold">{log.msg}</span>}
                                            {log.type === 'info' && <span>{log.msg}</span>}
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-neutral-500 text-center py-8">
                                        No active log captures.
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Completion / Exit controls */}
                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={handleCloseStudio}
                                className="flex-1 py-3 bg-neutral-950 border border-neutral-800 hover:bg-neutral-850 text-neutral-400 hover:text-white text-xs font-bold rounded-xl transition"
                            >
                                Leave Studio
                            </button>

                            {faceSamples.length >= targetFaceCount && gaitVideos.length >= targetGaitCount ? (
                                <Link
                                    to="/train"
                                    onClick={stopCamera}
                                    className="flex-1 py-3 bg-emerald-650 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/10 cursor-pointer text-center"
                                >
                                    <UserCheck size={14} />
                                    <span>Train models</span>
                                </Link>
                            ) : (
                                <button
                                    disabled
                                    className="flex-1 py-3 bg-neutral-900 border border-neutral-850 text-neutral-600 text-xs font-bold rounded-xl cursor-not-allowed text-center"
                                >
                                    Complete Targets
                                </button>
                            )}
                        </div>

                    </div>

                </div>
            )}
        </div>
    );
};

export default RegisterPerson;
