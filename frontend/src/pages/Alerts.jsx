import React, { useState, useEffect } from 'react';
import api from '../services/api';
import {
    AlertTriangle,
    ShieldCheck,
    RotateCw,
    Clock,
    Camera,
    CheckCircle
} from 'lucide-react';

const Alerts = () => {
    const [alerts, setAlerts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterResolved, setFilterResolved] = useState('false'); // default show unresolved checks
    const [actionMsg, setActionMsg] = useState('');

    const fetchAlerts = async () => {
        setLoading(true);
        try {
            const res = await api.get(`/alerts?is_resolved=${filterResolved}`);
            if (res.data.success) {
                setAlerts(res.data.data);
            }
        } catch (e) {
            console.error("Failed to load alerts queue:", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAlerts();
    }, [filterResolved]);

    const handleResolve = async (id) => {
        try {
            const res = await api.post(`/alerts/${id}/resolve`);
            if (res.data.success) {
                setActionMsg(`Alert #${id} marked as resolved.`);
                fetchAlerts();
            }
        } catch (err) {
            console.error(err);
            setActionMsg(`Failed to resolve alert: ${err.message}`);
        }
    };

    return (
        <div className="p-8 max-w-5xl mx-auto space-y-6 animate-fadeIn">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-neutral-800 pb-5">
                <div>
                    <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                        <AlertTriangle className="text-rose-500 animate-pulse" />
                        <span>Security Alarms Control</span>
                    </h2>
                    <p className="text-neutral-400 text-xs mt-1">
                        Review security logs flagged for "Unknown" person passes. Confirm credentials and resolve active alerts.
                    </p>
                </div>

                <div className="flex items-center gap-2.5">
                    <select
                        value={filterResolved}
                        onChange={(e) => setFilterResolved(e.target.value)}
                        className="px-3.5 py-1.5 bg-neutral-900 border border-neutral-800 rounded-xl text-xs text-neutral-300 focus:outline-none"
                    >
                        <option value="false">Unresolved Alerts Only</option>
                        <option value="true">Archived (Resolved)</option>
                        <option value="all">View All Alerts</option>
                    </select>

                    <button
                        onClick={fetchAlerts}
                        className="p-2 rounded-xl bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white transition flex items-center"
                    >
                        <RotateCw size={14} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {actionMsg && (
                <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs rounded-xl flex justify-between items-center">
                    <span>{actionMsg}</span>
                    <button onClick={() => setActionMsg('')} className="text-indigo-400 font-bold hover:text-white">✕</button>
                </div>
            )}

            {loading ? (
                <div className="text-center py-20 text-xs text-neutral-500">
                    Loading alerts queue...
                </div>
            ) : (
                <div className="space-y-4">
                    {alerts.length > 0 ? (
                        <div className="grid grid-cols-1 gap-4">
                            {alerts.map((alert) => (
                                <div
                                    key={alert.id}
                                    className={`p-5 rounded-2xl border transition flex flex-col md:flex-row md:items-center justify-between gap-4 bg-neutral-900 ${alert.is_resolved
                                            ? 'border-neutral-850 opacity-60'
                                            : 'border-rose-500/20 hover:border-rose-500/35 glow-red'
                                        }`}
                                >
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2.5">
                                            <span className={`w-2.5 h-2.5 rounded-full ${alert.is_resolved ? 'bg-neutral-500' : 'bg-red-500 animate-ping'
                                                }`}></span>
                                            <span className="font-extrabold text-neutral-200">Alert #{alert.id}</span>
                                            <span className="text-[10px] text-neutral-500 font-mono">ID #{alert.track_id}</span>
                                        </div>

                                        <p className="text-xs text-white leading-normal max-w-xl pr-3">{alert.details}</p>

                                        <div className="flex flex-wrap items-center gap-3 text-[10px] text-neutral-500">
                                            <div className="flex items-center gap-1">
                                                <Camera size={11} />
                                                <span>{alert.camera}</span>
                                            </div>
                                            <span>•</span>
                                            <div className="flex items-center gap-1">
                                                <Clock size={11} />
                                                <span>{new Date(alert.timestamp).toLocaleString()}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        {!alert.is_resolved ? (
                                            <button
                                                onClick={() => handleResolve(alert.id)}
                                                className="flex items-center gap-2 bg-rose-600 hover:bg-rose-500 font-extrabold text-white text-xs px-4 py-2 rounded-lg transition"
                                            >
                                                <ShieldCheck size={14} />
                                                <span>Acknowledge</span>
                                            </button>
                                        ) : (
                                            <span className="flex items-center gap-1.5 text-emerald-400 font-bold text-xs uppercase px-3 py-1 bg-emerald-500/10 rounded-lg">
                                                <CheckCircle size={14} />
                                                <span>Resolved</span>
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-20 text-xs text-neutral-550 bg-neutral-905/40 rounded-2xl border border-dashed border-neutral-800">
                            Clear queues. No unknown alarm alerts matching parameters found.
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default Alerts;
