import React, { useState, useEffect } from 'react';
import api from '../services/api';
import {
    Cpu,
    RefreshCw,
    Sliders,
    Play,
    Terminal,
    CheckCircle,
    AlertTriangle
} from 'lucide-react';

const TrainingCenter = () => {
    const [counts, setCounts] = useState({
        total_people: 0,
        face_samples: 0,
        gait_videos: 0,
        gait_features: 0
    });

    const [loading, setLoading] = useState(false);
    const [activeTask, setActiveTask] = useState('');
    const [consoleLogs, setConsoleLogs] = useState(['Aegis Core Console initialized. Ready for operations.']);
    const [modelResult, setModelResult] = useState(null);
    const [errorStatus, setErrorStatus] = useState('');

    const addLog = (text) => {
        const timestamp = new Date().toLocaleTimeString();
        setConsoleLogs(prev => [...prev, `[${timestamp}] ${text}`]);
    };

    const fetchDatasetDetails = async () => {
        try {
            const [analyticsRes] = await Promise.all([api.get('/analytics')]);
            if (analyticsRes.data.success) {
                const da = analyticsRes.data.data;
                // Query person list to calculate total faces/videos
                const personsRes = await api.get('/persons');
                if (personsRes.data.success) {
                    const list = personsRes.data.data;
                    let faces = 0;
                    let videos = 0;
                    let features = 0;
                    list.forEach(p => {
                        faces += p.face_samples_count || 0;
                        videos += p.gait_videos_count || 0;
                        features += p.gait_features_count || 0;
                    });
                    setCounts({
                        total_people: da.counts.total_people,
                        face_samples: faces,
                        gait_videos: videos,
                        gait_features: features
                    });
                }
            }
        } catch (e) {
            console.error(e);
            setErrorStatus("Failed to synchronize database counts.");
        }
    };

    useEffect(() => {
        fetchDatasetDetails();
    }, []);

    const handleExtractFace = async () => {
        setLoading(true);
        setActiveTask('face-extract');
        addLog("Initiating Face Feature Extraction Pipeline...");
        try {
            const res = await api.post('/features/extract-face');
            if (res.data.success) {
                addLog(res.data.message);
                addLog(`Processed and stored ${res.data.extracted_count} face embeddings (.npy vectors).`);
                if (res.data.failed_count > 0) {
                    addLog(`Warning: Failed to compile features for ${res.data.failed_count} face images (could not focus or align faces).`);
                }
            }
        } catch (err) {
            console.error(err);
            addLog(`ERROR: Face Feature extraction execution failed: ${err.response?.data?.error || err.message}`);
        } finally {
            setLoading(false);
            setActiveTask('');
            fetchDatasetDetails();
        }
    };

    const handleExtractGait = async () => {
        setLoading(true);
        setActiveTask('gait-extract');
        addLog("Initiating Gait Kinematics Feature Extraction Pipeline (MediaPipe active)...");
        try {
            const res = await api.post('/features/extract-gait');
            if (res.data.success) {
                addLog(res.data.message);
                res.data.details.forEach(item => {
                    if (item.success) {
                        addLog(`SUCCESS: ${item.video} -> Extracted walk feature vector (${item.frames} frames parsed)`);
                    } else {
                        addLog(`FAILED: ${item.video} -> ${item.reason}`);
                    }
                });
            }
        } catch (err) {
            console.error(err);
            addLog(`ERROR: Gait processing execution failed: ${err.response?.data?.error || err.message}`);
        } finally {
            setLoading(false);
            setActiveTask('');
            fetchDatasetDetails();
        }
    };

    const handleTrainModel = async () => {
        setLoading(true);
        setActiveTask('model-train');
        addLog("Fitting SVM and Random Forest Classifiers on gait features matrix...");
        try {
            const res = await api.post('/train/gait');
            if (res.data.success) {
                const metadata = res.data.data;
                setModelResult(metadata);
                addLog(`FIT SUCCESSFUL: Selected best model: ${metadata.best_algorithm}`);
                addLog(`Metrics -> Accuracy: ${(metadata.metrics.accuracy * 100).toFixed(1)}%, F1: ${metadata.metrics.f1_score.toFixed(2)}`);
                addLog(`Trained on: {Train: ${metadata.dataset_counts.train_samples}, Test: ${metadata.dataset_counts.test_samples}} sequences`);
            }
        } catch (err) {
            console.error(err);
            addLog(`ERROR: Classifier training crashed: ${err.response?.data?.error || err.message}`);
        } finally {
            setLoading(false);
            setActiveTask('');
            fetchDatasetDetails();
        }
    };

    return (
        <div className="p-8 max-w-5xl mx-auto space-y-6 animate-fadeIn">
            {/* Header */}
            <div className="border-b border-neutral-800 pb-5">
                <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                    <Cpu className="text-indigo-500" />
                    <span>Biometric Training Center</span>
                </h2>
                <p className="text-neutral-400 text-xs mt-1">
                    Perform local features collection, fit machine learning classification models, and view learning telemetry reports.
                </p>
            </div>

            {errorStatus && (
                <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs rounded-xl flex items-center gap-3">
                    <AlertTriangle size={16} />
                    <span>{errorStatus}</span>
                </div>
            )}

            {/* Grid count summary and console */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Left Side: Pipeline Triggers */}
                <div className="space-y-4 lg:col-span-1">

                    {/* Numbers Dashboard */}
                    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 space-y-3.5">
                        <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider border-b border-neutral-800 pb-1.5 flex items-center justify-between">
                            <span>Database Size</span>
                            <button onClick={fetchDatasetDetails} className="text-indigo-400 hover:text-white">✕ Refresh</button>
                        </h3>

                        <div className="grid grid-cols-2 gap-3 text-xs">
                            <div className="bg-neutral-950 p-3 rounded-xl border border-neutral-850">
                                <span className="text-neutral-500 block">Profiles</span>
                                <span className="text-md font-bold text-white font-mono mt-1 block">{counts.total_people}</span>
                            </div>
                            <div className="bg-neutral-950 p-3 rounded-xl border border-neutral-850">
                                <span className="text-neutral-500 block">Face Images</span>
                                <span className="text-md font-bold text-white font-mono mt-1 block">{counts.face_samples}</span>
                            </div>
                            <div className="bg-neutral-950 p-3 rounded-xl border border-neutral-850">
                                <span className="text-neutral-500 block">Gait Videos</span>
                                <span className="text-md font-bold text-white font-mono mt-1 block">{counts.gait_videos}</span>
                            </div>
                            <div className="bg-neutral-950 p-3 rounded-xl border border-neutral-850">
                                <span className="text-neutral-500 block">Gait Feats</span>
                                <span className={`text-md font-bold font-mono mt-1 block ${counts.gait_videos !== counts.gait_features ? 'text-amber-400' : 'text-emerald-400'}`}>
                                    {counts.gait_features}
                                </span>
                            </div>
                        </div>

                        {/* Status banner */}
                        <div className="pt-2.5 border-t border-neutral-850/50 flex flex-col space-y-1">
                            <span className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider">Status</span>
                            {counts.total_people === 0 || counts.gait_videos === 0 ? (
                                <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-extrabold rounded-xl text-center tracking-wide uppercase">
                                    NO TRAINING DATA
                                </div>
                            ) : (
                                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-extrabold rounded-xl text-center tracking-wide uppercase">
                                    READY FOR TRAINING
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Actions Panel */}
                    <div className="bg-neutral-900 border border-neutral-850 rounded-2xl p-5 space-y-3">
                        <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider border-b border-neutral-800 pb-1.5">
                            Processing Controls
                        </h3>

                        <div className="space-y-2">
                            <button
                                disabled={loading}
                                onClick={handleExtractFace}
                                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-semibold bg-neutral-950 border border-neutral-800 hover:bg-neutral-850 hover:text-white text-indigo-400 transition"
                            >
                                {activeTask === 'face-extract' && <RefreshCw size={14} className="animate-spin" />}
                                <span>Extract Face Features</span>
                            </button>

                            <button
                                disabled={loading}
                                onClick={handleExtractGait}
                                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-semibold bg-neutral-950 border border-neutral-800 hover:bg-neutral-850 hover:text-white text-indigo-400 transition"
                            >
                                {activeTask === 'gait-extract' && <RefreshCw size={14} className="animate-spin" />}
                                <span>Extract Gait Features</span>
                            </button>

                            <button
                                disabled={loading || counts.gait_features < 2}
                                onClick={handleTrainModel}
                                className="w-full flex items-center justify-center gap-2 py-3 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-650/15 transition disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                {activeTask === 'model-train' && <RefreshCw size={14} className="animate-spin" />}
                                <span>Train Gait Classifier</span>
                            </button>
                            {counts.gait_features < 2 && (
                                <p className="text-[10px] text-amber-500/80 leading-normal text-center mt-1">
                                    At least 2 profiles with gait feature vectors are required to compile multi-class classifiers.
                                </p>
                            )}
                        </div>
                    </div>

                </div>

                {/* Right Side: STDOUT Terminal Console */}
                <div className="lg:col-span-2 flex flex-col space-y-4">
                    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 flex flex-col flex-1">
                        <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-3 border-b border-neutral-800 pb-2">
                            <Terminal size={16} className="text-indigo-400" />
                            <span>Compilation Logs console</span>
                        </h3>

                        <div className="flex-1 min-h-[300px] max-h-[350px] overflow-y-auto bg-neutral-950/70 border border-neutral-850 p-4 rounded-xl font-mono text-[10px] text-neutral-300 space-y-1.5 scroll-smooth">
                            {consoleLogs.map((log, i) => (
                                <div key={i} className="leading-relaxed whitespace-pre-wrap">
                                    {log.includes("ERROR:") ? (
                                        <span className="text-rose-400 font-bold">{log}</span>
                                    ) : log.includes("SUCCESS:") || log.includes("FIT SUCCESSFUL:") ? (
                                        <span className="text-emerald-400 font-bold">{log}</span>
                                    ) : log.includes("Warning:") ? (
                                        <span className="text-amber-400 font-bold">{log}</span>
                                    ) : (
                                        log
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default TrainingCenter;
