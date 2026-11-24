import React, { useState, useEffect } from 'react';
import api from '../services/api';
import {
    Settings2,
    Cpu,
    Activity,
    RefreshCw
} from 'lucide-react';

const ModelManagement = () => {
    const [loading, setLoading] = useState(true);
    const [modelsData, setModelsData] = useState({
        face_model: { status: 'LOADING' },
        gait_model: { status: 'NOT TRAINED' }
    });
    const [errorStatus, setErrorStatus] = useState('');

    const fetchModelsStatus = async () => {
        setLoading(true);
        try {
            const res = await api.get('/models');
            if (res.data.success) {
                setModelsData(res.data.data);
                setErrorStatus('');
            }
        } catch (err) {
            console.error(err);
            setErrorStatus("Failed to query models status details.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchModelsStatus();
    }, []);

    const renderConfusionMatrix = (matrix, classes) => {
        if (!matrix || !classes || matrix.length === 0) {
            return (
                <div className="py-8 text-center text-xs text-neutral-500 bg-neutral-950/40 rounded-xl border border-dashed border-neutral-850">
                    No validation test indices to chart.
                </div>
            );
        }

        return (
            <div className="space-y-4">
                <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">
                    Validation grid (Actual vs Predicted)
                </label>
                <div className="overflow-x-auto p-2 bg-neutral-950 rounded-xl border border-neutral-850">
                    <div className="min-w-[400px]">
                        {/* Header X labels */}
                        <div className="grid grid-cols-[100px_repeat(auto-fit,minmax(50px,1fr))] gap-2 text-center text-[10px] pb-2 border-b border-neutral-850">
                            <div className="text-left font-bold text-indigo-400">Actual \ Pred</div>
                            {classes.map((cls, i) => (
                                <div key={i} className="font-mono font-bold text-neutral-350 truncate">{cls}</div>
                            ))}
                        </div>

                        {/* Matrix rows */}
                        <div className="mt-2 space-y-2">
                            {classes.map((rowCls, rIdx) => (
                                <div key={rIdx} className="grid grid-cols-[100px_repeat(auto-fit,minmax(50px,1fr))] gap-2 items-center text-center text-xs">
                                    {/* Row heading */}
                                    <div className="text-left font-mono font-bold text-neutral-350 truncate pr-2">{rowCls}</div>

                                    {/* Row elements */}
                                    {classes.map((colCls, cIdx) => {
                                        const count = matrix[rIdx][cIdx] || 0;
                                        const isDiagonal = rIdx === cIdx;

                                        // Style coloring based on counts
                                        let cellStyle = "bg-neutral-900 text-neutral-500 border border-neutral-850";
                                        if (count > 0) {
                                            if (isDiagonal) {
                                                cellStyle = "bg-emerald-500/20 text-emerald-350 font-bold border border-emerald-500/30 glow-green";
                                            } else {
                                                cellStyle = "bg-rose-500/25 text-rose-350 font-semibold border border-rose-500/30";
                                            }
                                        }

                                        return (
                                            <div
                                                key={cIdx}
                                                className={`py-3 rounded-lg text-xs leading-none transition cursor-default ${cellStyle}`}
                                                title={`Actual: ${rowCls}, Predicted: ${colCls} -> Count: ${count}`}
                                            >
                                                {count}
                                            </div>
                                        );
                                    })}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
                <p className="text-[10px] text-neutral-500">
                    * Green slots represent hits (matching classifications). Red slots denote misclassifications.
                </p>
            </div>
        );
    };

    const { face_model, gait_model } = modelsData;

    return (
        <div className="p-8 max-w-6xl mx-auto space-y-6 animate-fadeIn">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-neutral-800 pb-5">
                <div>
                    <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                        <Settings2 className="text-indigo-500" />
                        <span>Biometric Models Manager</span>
                    </h2>
                    <p className="text-neutral-400 text-xs mt-1">
                        Review specifications of registered classification engines. Contrast SVM/RF accuracy levels.
                    </p>
                </div>

                <button
                    onClick={fetchModelsStatus}
                    className="p-2 ml-4 rounded-xl bg-neutral-900 border border-neutral-850 text-neutral-400 hover:text-white transition flex items-center gap-1.5 text-xs font-semibold"
                >
                    <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                    <span>Refresh Status</span>
                </button>
            </div>

            {errorStatus && (
                <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs rounded-xl flex items-center gap-3">
                    <span>{errorStatus}</span>
                </div>
            )}

            {loading ? (
                <div className="text-center py-20 text-xs text-neutral-500">
                    Loading models specification reports...
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                    {/* Face Model specifications (Left Panel) */}
                    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 space-y-5">
                        <h3 className="text-md font-bold text-white uppercase tracking-wider border-b border-neutral-800 pb-2.5 flex items-center gap-2">
                            <Activity size={16} className="text-indigo-400" />
                            <span>Face Embedding Model</span>
                        </h3>

                        <div className="space-y-4 text-xs">
                            <div className="flex justify-between border-b border-neutral-850 pb-2">
                                <span className="text-neutral-400 font-semibold">Engine System</span>
                                <span className="text-white font-bold">{face_model.name}</span>
                            </div>
                            <div className="flex justify-between border-b border-neutral-850 pb-2">
                                <span className="text-neutral-400 font-semibold">Model Class Type</span>
                                <span className="text-white font-medium">{face_model.type}</span>
                            </div>
                            <div className="flex justify-between border-b border-neutral-850 pb-2">
                                <span className="text-neutral-400 font-semibold">Status</span>
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${face_model.status === 'READY' ? 'bg-emerald-500/10 text-emerald-450' : 'bg-red-500/10 text-rose-450'
                                    }`}>
                                    {face_model.status}
                                </span>
                            </div>
                            <div className="flex justify-between border-b border-neutral-850 pb-2">
                                <span className="text-neutral-400 font-semibold">Model Version</span>
                                <span className="text-white font-mono">{face_model.version}</span>
                            </div>
                            <div className="flex justify-between pb-2">
                                <span className="text-neutral-400 font-semibold">Feature Dim</span>
                                <span className="text-indigo-400 font-bold font-mono">128-Dimensional vector space</span>
                            </div>
                        </div>

                        <div className="p-3.5 bg-neutral-950/60 border border-neutral-850 rounded-xl text-[10px] text-neutral-400 leading-relaxed">
                            * The Face Recognition framework utilizes a pretrained SFace recognizer, extracting facial shapes, aligned eyes, and mapping similarity to Cosine space indexes. It bypasses training loops.
                        </div>
                    </div>

                    {/* Gait Model specifications (Right Panel) */}
                    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 space-y-5">
                        <h3 className="text-md font-bold text-white uppercase tracking-wider border-b border-neutral-800 pb-2.5 flex items-center gap-2">
                            <Cpu size={16} className="text-indigo-400" />
                            <span>Gait Classifier Model</span>
                        </h3>

                        <div className="space-y-4 text-xs">
                            <div className="flex justify-between border-b border-neutral-850 pb-2">
                                <span className="text-neutral-400 font-semibold">Classifier Algorithm</span>
                                <span className="text-white font-bold">{gait_model.best_algorithm || 'N/A'}</span>
                            </div>
                            <div className="flex justify-between border-b border-neutral-850 pb-2">
                                <span className="text-neutral-400 font-semibold">Status</span>
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${gait_model.status === 'TRAINED' ? 'bg-emerald-500/10 text-emerald-450' : 'bg-red-500/10 text-rose-455'
                                    }`}>
                                    {gait_model.status}
                                </span>
                            </div>

                            {gait_model.status === 'TRAINED' && (
                                <>
                                    <div className="flex justify-between border-b border-neutral-850 pb-2">
                                        <span className="text-neutral-400 font-semibold">Training Timestamp</span>
                                        <span className="text-white font-mono">{gait_model.training_date}</span>
                                    </div>
                                    <div className="flex justify-between border-b border-neutral-850 pb-2">
                                        <span className="text-neutral-400 font-semibold">Model Version</span>
                                        <span className="text-white font-mono">{gait_model.version}</span>
                                    </div>
                                    <div className="flex justify-between border-b border-neutral-850 pb-2">
                                        <span className="text-neutral-400 font-semibold">Total walk sequences</span>
                                        <span className="text-white font-medium">{gait_model.dataset_counts?.total_samples} samples</span>
                                    </div>
                                </>
                            )}
                        </div>

                        {gait_model.status === 'TRAINED' ? (
                            <div className="space-y-4 pt-2">
                                <div className="grid grid-cols-4 gap-3 text-center">
                                    <div className="p-2 bg-neutral-950 rounded-xl border border-neutral-850">
                                        <span className="text-neutral-500 block text-[9px] uppercase">Accuracy</span>
                                        <span className="text-xs font-bold text-white font-mono mt-0.5 block">{(gait_model.metrics.accuracy * 100).toFixed(1)}%</span>
                                    </div>
                                    <div className="p-2 bg-neutral-950 rounded-xl border border-neutral-850">
                                        <span className="text-neutral-500 block text-[9px] uppercase">Precision</span>
                                        <span className="text-xs font-bold text-white font-mono mt-0.5 block">{gait_model.metrics.precision.toFixed(2)}</span>
                                    </div>
                                    <div className="p-2 bg-neutral-950 rounded-xl border border-neutral-850">
                                        <span className="text-neutral-500 block text-[9px] uppercase">Recall</span>
                                        <span className="text-xs font-bold text-white font-mono mt-0.5 block">{gait_model.metrics.recall.toFixed(2)}</span>
                                    </div>
                                    <div className="p-2 bg-neutral-950 rounded-xl border border-neutral-850">
                                        <span className="text-neutral-500 block text-[9px] uppercase">F1-Score</span>
                                        <span className="text-xs font-bold text-white font-mono mt-0.5 block">{gait_model.metrics.f1_score.toFixed(2)}</span>
                                    </div>
                                </div>

                                <div className="border-t border-neutral-850 pt-4">
                                    {renderConfusionMatrix(gait_model.confusion_matrix, gait_model.classes)}
                                </div>
                            </div>
                        ) : (
                            <div className="p-8 text-center text-xs text-neutral-500 bg-neutral-950/40 rounded-xl border border-dashed border-neutral-800 space-y-2.5">
                                <p className="text-white font-bold">Gait Recognition Model has not been trained.</p>
                                <p className="text-neutral-400 font-medium">Insufficient data for reliable evaluation.</p>
                                <p className="text-indigo-400 font-bold uppercase tracking-wider">Add more real walking samples.</p>
                            </div>
                        )}
                    </div>

                </div>
            )}
        </div>
    );
};

export default ModelManagement;
