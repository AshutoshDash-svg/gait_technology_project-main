import React, { useState, useEffect } from 'react';
import api, { apiBaseUrl } from '../services/api';
import {
    Play,
    Square,
    Settings2,
    ShieldAlert,
    Activity,
    Cpu,
    Camera,
    EyeOff
} from 'lucide-react';

const LiveMonitor = () => {
    const [status, setStatus] = useState({
        is_running: false,
        source: 0,
        active_tracks_count: 0,
        active_tracks: {},
        face_threshold: 0.65,
        gait_threshold: 0.60
    });

    const [cameraInput, setCameraInput] = useState('0');
    const [faceSlider, setFaceSlider] = useState(0.65);
    const [gaitSlider, setGaitSlider] = useState(0.60);
    const [feedTimestamp, setFeedTimestamp] = useState(Date.now());
    const [feedbackMsg, setFeedbackMsg] = useState('');
    const [errorMsg, setErrorMsg] = useState('');
    const [showDevSettings, setShowDevSettings] = useState(false);

    // Fetch status on mount and poll
    const fetchStatus = async () => {
        try {
            const res = await api.get('/surveillance/status');
            if (res.data.success) {
                const data = res.data.data;
                setStatus(data);
                setFaceSlider(data.face_threshold);
                setGaitSlider(data.gait_threshold);
                setErrorMsg('');
            }
        } catch (e) {
            console.error(e);
            setErrorMsg("Could not connect to Flask API server. Verify backend is running.");
        }
    };

    useEffect(() => {
        fetchStatus();
        const interval = setInterval(fetchStatus, 1000); // Poll active track listings every second
        return () => clearInterval(interval);
    }, []);

    const handleStart = async () => {
        try {
            setFeedbackMsg("Connecting to camera stream...");
            const res = await api.post('/surveillance/start', { source: cameraInput });
            if (res.data.success) {
                setFeedTimestamp(Date.now());
                fetchStatus();
                setFeedbackMsg("Surveillance started successfully.");
            }
        } catch (err) {
            console.error(err);
            setErrorMsg(err.response?.data?.error || "Failed to start camera stream.");
        }
    };

    const handleStop = async () => {
        try {
            const res = await api.post('/surveillance/stop');
            if (res.data.success) {
                fetchStatus();
                setFeedbackMsg("Surveillance stopped.");
            }
        } catch (err) {
            console.error(err);
            setErrorMsg("Failed to stop stream.");
        }
    };

    const handleSaveThresholds = async () => {
        try {
            const res = await api.post('/surveillance/settings', {
                face_threshold: faceSlider,
                gait_threshold: gaitSlider
            });
            if (res.data.success) {
                setFeedbackMsg("Decision thresholds saved.");
                fetchStatus();
            }
        } catch (err) {
            console.error(err);
            setErrorMsg("Failed to update thresholds.");
        }
    };

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-6 animate-fadeIn">
            {/* Page Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-neutral-800 pb-5 gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                        <Camera className="text-indigo-500" />
                        <span>Interactive CCTV Live Monitor</span>
                    </h2>
                    <p className="text-neutral-400 text-xs mt-1">
                        Real-time multi-modal person tracking utilizing advanced face vector verification and gait biometric fallback.
                    </p>
                </div>

                {/* Status indicator banner */}
                <div className="flex items-center gap-2">
                    {status.is_running ? (
                        <span className="flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-full font-bold">
                            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-ping"></span>
                            STREAM ACTIVE (Source: {status.source})
                        </span>
                    ) : (
                        <span className="flex items-center gap-2 px-3 py-1 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-full font-bold">
                            <EyeOff size={14} />
                            SURVEILLANCE OFFLINE
                        </span>
                    )}
                </div>
            </div>

            {feedbackMsg && (
                <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs rounded-xl flex justify-between items-center">
                    <span>{feedbackMsg}</span>
                    <button onClick={() => setFeedbackMsg('')} className="text-indigo-400 font-bold hover:text-white">✕</button>
                </div>
            )}
            {errorMsg && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs rounded-xl flex justify-between items-center">
                    <span>{errorMsg}</span>
                    <button onClick={() => setErrorMsg('')} className="text-rose-400 font-bold hover:text-white">✕</button>
                </div>
            )}

            {/* Grid Layout: Stream (Left) vs Controls/Tracks (Right) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* CCTV Image Source (Spans 2 columns) */}
                <div className="lg:col-span-2 space-y-4">
                    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 overflow-hidden relative">
                        <div className="aspect-video bg-neutral-950 rounded-xl overflow-hidden flex items-center justify-center border border-neutral-800/60 relative">
                            {status.is_running ? (
                                <img
                                    src={`${apiBaseUrl}/api/surveillance/video_feed?t=${feedTimestamp}`}
                                    alt="Surveillance Feed"
                                    className="w-full h-full object-contain"
                                />
                            ) : (
                                <div className="text-center p-8 space-y-4">
                                    <div className="w-16 h-16 rounded-full bg-neutral-900 flex items-center justify-center mx-auto text-neutral-500 border border-neutral-800">
                                        <EyeOff size={32} />
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-white text-sm font-bold">Surveillance Stream Offline</p>
                                        <p className="text-neutral-500 text-xs">Initialize camera stream via the right dashboard selectors.</p>
                                    </div>
                                </div>
                            )}

                            {/* Overlay Indicators */}
                            <div className="absolute top-4 left-4 bg-neutral-900/90 border border-neutral-800 text-[10px] text-white px-2.5 py-1 rounded font-mono font-bold flex items-center gap-1.5 backdrop-blur-md">
                                <span className={`w-1.5 h-1.5 rounded-full ${status.is_running ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`}></span>
                                CCTV CAMERA 01
                            </div>
                        </div>
                    </div>

                    {/* Active tracks list on screen */}
                    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6">
                        <h3 className="text-sm font-bold text-white mb-4 uppercase tracking-wider flex items-center gap-2 border-b border-neutral-800 pb-2">
                            <Activity size={16} className="text-indigo-400" />
                            <span>Visible Track Detections ({Object.keys(status.active_tracks).length})</span>
                        </h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {Object.keys(status.active_tracks).length > 0 ? (
                                Object.entries(status.active_tracks).map(([tid, detail]) => {
                                    const isUnknown = detail.status === 'ALERT' || detail.person_id === 'Unknown';
                                    const isProcessing = detail.status === 'PROCESSING';

                                    return (
                                        <div
                                            key={tid}
                                            className={`p-4 bg-neutral-950 border rounded-xl flex flex-col justify-between space-y-3 transition duration-150 ${isUnknown ? 'border-rose-500/20 hover:border-rose-500/30' : (isProcessing ? 'border-amber-500/20 hover:border-amber-500/30' : 'border-emerald-500/20 hover:border-emerald-500/30')
                                                }`}
                                        >
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-extrabold text-neutral-300">Track #{tid}</span>
                                                <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${isUnknown ? 'bg-red-500/10 text-rose-400' : (isProcessing ? 'bg-amber-500/10 text-amber-400 animate-pulse' : 'bg-emerald-500/10 text-emerald-400')
                                                    }`}>
                                                    {detail.status}
                                                </span>
                                            </div>

                                            <div>
                                                <h4 className="text-md font-bold text-white">{detail.name}</h4>
                                                <p className="text-[10px] text-neutral-500 mt-0.5">{detail.details}</p>
                                            </div>

                                            <div className="bg-neutral-900/40 p-2 rounded-lg flex items-center justify-between text-[10px]">
                                                <span className="text-neutral-400 font-medium">Method:</span>
                                                <span className="text-indigo-400 font-extrabold">{detail.method}</span>
                                                <span className="text-neutral-400 font-mono font-bold bg-neutral-900 px-1 py-0.5 rounded">
                                                    C: {detail.confidence.toFixed(2)}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="col-span-2 text-center py-6 text-xs text-neutral-500 bg-neutral-950/40 rounded-xl border border-dashed border-neutral-800">
                                    No active human targets detected in camera scene.
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Sidebar Controls (Spans 1 column) */}
                <div className="space-y-6">

                    {/* Camera Source Selector Controls */}
                    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 space-y-4">
                        <h3 className="text-md font-bold text-white flex items-center gap-2">
                            <Camera size={18} className="text-indigo-400" />
                            <span>Camera Setup</span>
                        </h3>

                        <div className="space-y-3">
                            <div>
                                <label className="block text-[11px] font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">Input Selection</label>
                                <select
                                    value={cameraInput}
                                    onChange={(e) => setCameraInput(e.target.value)}
                                    className="w-full px-3 py-2 bg-neutral-950 border border-neutral-850 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-600"
                                >
                                    <option value="0">Default Webcam (0)</option>
                                    <option value="1">External Camera 1 (1)</option>
                                    <option value="2">External Camera 2 (2)</option>
                                </select>
                            </div>

                            {/* Dev configuration hidden by default */}
                            <div className="pt-2 border-t border-neutral-850/60">
                                <label className="flex items-center gap-2 cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        checked={showDevSettings}
                                        onChange={(e) => setShowDevSettings(e.target.checked)}
                                        className="rounded bg-neutral-950 border-neutral-800 text-indigo-600 focus:ring-0 focus:ring-offset-0"
                                    />
                                    <span className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider">Show Development Override</span>
                                </label>

                                {showDevSettings && (
                                    <div className="mt-3 space-y-2">
                                        <label className="block text-[9px] font-bold text-neutral-500 uppercase">Test Video Path / Stream Override</label>
                                        <input
                                            type="text"
                                            value={cameraInput}
                                            onChange={(e) => setCameraInput(e.target.value)}
                                            placeholder="Enter absolute path to test video file"
                                            className="w-full px-3 py-2 bg-neutral-950 border border-neutral-850 rounded-xl text-[10px] text-white placeholder-neutral-600 focus:outline-none focus:border-indigo-650"
                                        />
                                        <p className="text-[9px] text-neutral-500 leading-normal">
                                            * Development testing only. Use this to simulate camera feeds with pre-captured walking sequences.
                                        </p>
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    disabled={status.is_running}
                                    onClick={handleStart}
                                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-semibold transition bg-indigo-600 text-white hover:bg-indigo-500 shadow-md shadow-indigo-600/10 ${status.is_running ? 'opacity-40 cursor-not-allowed' : ''
                                        }`}
                                >
                                    <Play size={14} />
                                    <span>Start Feed</span>
                                </button>
                                <button
                                    disabled={!status.is_running}
                                    onClick={handleStop}
                                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-semibold transition border border-rose-500/20 text-rose-455 hover:bg-rose-500/10 ${!status.is_running ? 'opacity-40 cursor-not-allowed' : ''
                                        }`}
                                >
                                    <Square size={14} />
                                    <span>Stop Feed</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Biometric Threshold Slider Controls */}
                    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 space-y-5">
                        <div className="flex items-center justify-between">
                            <h3 className="text-md font-bold text-white flex items-center gap-2">
                                <Settings2 size={18} className="text-indigo-400" />
                                <span>Decision Thresholds</span>
                            </h3>
                            <button
                                onClick={handleSaveThresholds}
                                className="text-[10px] bg-neutral-950 border border-neutral-800 hover:bg-neutral-850 text-indigo-400 font-bold px-2.5 py-1 rounded"
                            >
                                Apply
                            </button>
                        </div>

                        {/* Face Slide */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between text-xs">
                                <span className="text-neutral-400">Face Recognition Match:</span>
                                <span className="text-white font-mono font-bold bg-neutral-950 px-2 py-0.5 rounded">{faceSlider.toFixed(2)}</span>
                            </div>
                            <input
                                type="range"
                                min="0.30"
                                max="0.95"
                                step="0.05"
                                value={faceSlider}
                                onChange={(e) => setFaceSlider(parseFloat(e.target.value))}
                                className="w-full h-1.5 bg-neutral-950 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                            />
                            <p className="text-[10px] text-neutral-500">
                                Minimum cosine matching similarity. Faces below this fallback to gait recognition.
                            </p>
                        </div>

                        {/* Gait Slide */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between text-xs">
                                <span className="text-neutral-400">Gait Classifier Match:</span>
                                <span className="text-white font-mono font-bold bg-neutral-950 px-2 py-0.5 rounded">{gaitSlider.toFixed(2)}</span>
                            </div>
                            <input
                                type="range"
                                min="0.30"
                                max="0.95"
                                step="0.05"
                                value={gaitSlider}
                                onChange={(e) => setGaitSlider(parseFloat(e.target.value))}
                                className="w-full h-1.5 bg-neutral-950 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                            />
                            <p className="text-[10px] text-neutral-500">
                                Min probability threshold for SVM model. Low scores triggers Unknown alarm.
                            </p>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default LiveMonitor;
