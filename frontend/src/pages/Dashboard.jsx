import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import {
    Users,
    Eye,
    AlertTriangle,
    Cpu,
    Clock,
    ArrowRight,
    Server,
    Activity
} from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';

const Dashboard = () => {
    const [stats, setStats] = useState({
        total_people: 0,
        total_detections: 0,
        total_alerts: 0,
        unresolved_alerts: 0,
        face_model: { status: 'LOADING' },
        gait_model: { status: 'LOADING', best_algorithm: 'N/A' },
    });
    const [recentDetections, setRecentDetections] = useState([]);
    const [timeTrendData, setTimeTrendData] = useState([]);
    const [errorStatus, setErrorStatus] = useState(null);
    const [loading, setLoading] = useState(true);

    // Poll database stats
    useEffect(() => {
        const fetchDashboardData = async () => {
            try {
                // Fetch calculations
                const [analyticsRes, modelsRes, detectionsRes] = await Promise.all([
                    api.get('/analytics'),
                    api.get('/models'),
                    api.get('/detections?limit=5')
                ]);

                if (analyticsRes.data.success) {
                    const anc = analyticsRes.data.data;
                    setStats(prev => ({
                        ...prev,
                        total_people: anc.counts.total_people,
                        total_detections: anc.counts.total_detections,
                        total_alerts: anc.counts.total_alerts,
                        unresolved_alerts: anc.counts.unresolved_alerts,
                    }));
                    setTimeTrendData(anc.time_trend);
                }

                if (modelsRes.data.success) {
                    const mod = modelsRes.data.data;
                    setStats(prev => ({
                        ...prev,
                        face_model: mod.face_model,
                        gait_model: mod.gait_model,
                    }));
                }

                if (detectionsRes.data.success) {
                    setRecentDetections(detectionsRes.data.data);
                }

                setErrorStatus(null);
            } catch (err) {
                console.error("Failed to load dashboard statistics:", err);
                setErrorStatus("Could not connect to Flask API server. Make sure Python app is running.");
            } finally {
                setLoading(false);
            }
        };

        fetchDashboardData();
        const interval = setInterval(fetchDashboardData, 3000); // refresh every 3s
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8 animate-fadeIn">
            {/* Header Profile Title */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-neutral-800 pb-6">
                <div>
                    <h2 className="text-3xl font-extrabold text-white tracking-tight">System Dashboard</h2>
                    <p className="text-neutral-400 mt-1 max-w-2xl text-sm">
                        AEGIS Command: Multimodal surveillance fusion tracking face biometric features and walk sequence kinematics.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-neutral-900 border border-neutral-800 text-[11px] text-neutral-400 font-medium">
                        <Server size={12} className="text-indigo-400" />
                        <span>API Status: </span>
                        {errorStatus ? (
                            <span className="text-rose-500 font-bold">OFFLINE</span>
                        ) : (
                            <span className="text-emerald-500 font-bold">ONLINE</span>
                        )}
                    </div>
                    <Link
                        to="/live"
                        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs px-4 py-2.5 rounded-lg shadow-lg shadow-indigo-600/20 transition-all duration-150"
                    >
                        <span>Go to Live CCTV</span>
                        <ArrowRight size={14} />
                    </Link>
                </div>
            </div>

            {errorStatus && (
                <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-xl flex items-center gap-3">
                    <AlertTriangle size={18} className="text-rose-400 shrink-0" />
                    <span className="text-sm font-semibold">{errorStatus}</span>
                </div>
            )}

            {/* Grid statistics summaries */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Card 1: Profiles */}
                <div className="bg-neutral-900 border border-neutral-800/80 rounded-2xl p-6 relative overflow-hidden transition-all duration-200 hover:border-neutral-700/80 group">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-600/5 rounded-full blur-2xl group-hover:bg-indigo-600/10 transition-all"></div>
                    <div className="flex items-center justify-between">
                        <span className="text-neutral-400 text-xs font-semibold uppercase tracking-wider">Registered People</span>
                        <div className="p-2 ml-4 rounded-xl bg-indigo-600/10 border border-indigo-500/20 text-indigo-400">
                            <Users size={20} />
                        </div>
                    </div>
                    <div className="mt-4">
                        <h3 className="text-3xl font-extrabold text-white">{stats.total_people}</h3>
                        <p className="text-neutral-500 text-[11px] mt-1">Authorized biometric profiles</p>
                    </div>
                </div>

                {/* Card 2: Detections */}
                <div className="bg-neutral-900 border border-neutral-800/80 rounded-2xl p-6 relative overflow-hidden transition-all duration-200 hover:border-neutral-700/80 group">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-600/5 rounded-full blur-2xl group-hover:bg-emerald-600/10 transition-all"></div>
                    <div className="flex items-center justify-between">
                        <span className="text-neutral-400 text-xs font-semibold uppercase tracking-wider">Total Detections</span>
                        <div className="p-2 ml-4 rounded-xl bg-emerald-600/10 border border-emerald-500/20 text-emerald-400">
                            <Activity size={20} />
                        </div>
                    </div>
                    <div className="mt-4">
                        <h3 className="text-3xl font-extrabold text-white">{stats.total_detections}</h3>
                        <p className="text-neutral-500 text-[11px] mt-1">Cross-referencing instances</p>
                    </div>
                </div>

                {/* Card 3: Alerts */}
                <div className="bg-neutral-900 border border-neutral-800/80 rounded-2xl p-6 relative overflow-hidden transition-all duration-200 hover:border-neutral-700/80 group">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-rose-600/5 rounded-full blur-2xl group-hover:bg-rose-600/10 transition-all"></div>
                    <div className="flex items-center justify-between">
                        <span className="text-neutral-400 text-xs font-semibold uppercase tracking-wider">Active Alarms</span>
                        <div className="p-2 ml-4 rounded-xl bg-rose-600/10 border border-rose-500/20 text-rose-400">
                            <AlertTriangle size={20} />
                        </div>
                    </div>
                    <div className="mt-4">
                        <h3 className="text-3xl font-extrabold text-white">{stats.unresolved_alerts}</h3>
                        <p className="text-neutral-500 text-[11px] mt-1">Unresolved Unknown logs ({stats.total_alerts} total)</p>
                    </div>
                </div>

                {/* Card 4: Gait status */}
                <div className="bg-neutral-900 border border-neutral-800/80 rounded-2xl p-6 relative overflow-hidden transition-all duration-200 hover:border-neutral-700/80 group">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-amber-600/5 rounded-full blur-2xl group-hover:bg-amber-600/10 transition-all"></div>
                    <div className="flex items-center justify-between">
                        <span className="text-neutral-400 text-xs font-semibold uppercase tracking-wider">Gait Classifier</span>
                        <div className="p-2 ml-4 rounded-xl bg-amber-600/10 border border-amber-500/20 text-amber-400">
                            <Cpu size={20} />
                        </div>
                    </div>
                    <div className="mt-4">
                        <h3 className="text-sm font-extrabold text-white uppercase mt-2">
                            <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${stats.gait_model.status === 'TRAINED' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-rose-400'
                                }`}>
                                {stats.gait_model.status}
                            </span>
                        </h3>
                        <p className="text-neutral-500 text-[11px] mt-2">
                            {stats.gait_model.status === 'TRAINED' ? `Best model: ${stats.gait_model.best_algorithm}` : "Gait SVM model not trained"}
                        </p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Trend Area Chart (2/3 width) */}
                <div className="bg-neutral-900 border border-neutral-800/85 rounded-2xl p-6 lg:col-span-2 flex flex-col space-y-4">
                    <div>
                        <h3 className="text-lg font-bold text-white">Detection Metrics (Last 24h)</h3>
                        <p className="text-xs text-neutral-400">Time trend evaluation for security checkpoints</p>
                    </div>
                    <div className="h-64 mt-4 w-full">
                        {timeTrendData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={timeTrendData}>
                                    <defs>
                                        <linearGradient id="colorDetections" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.4} />
                                            <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                                        </linearGradient>
                                        <linearGradient id="colorAlerts" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#ef4444" stopOpacity={0.4} />
                                            <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <XAxis dataKey="time" stroke="#525252" tickLine={false} style={{ fontSize: 10 }} />
                                    <YAxis stroke="#525252" tickLine={false} style={{ fontSize: 10 }} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#171717', borderColor: '#262626', borderRadius: 8 }}
                                        labelStyle={{ color: '#e5e5e5', fontWeight: 'bold' }}
                                    />
                                    <Area type="monotone" dataKey="detections" name="Total Passes" stroke="#4f46e5" strokeWidth={2} fillOpacity={1} fill="url(#colorDetections)" />
                                    <Area type="monotone" dataKey="alerts" name="Alarms (Unknown)" stroke="#ef4444" strokeWidth={2} fillOpacity={1} fill="url(#colorAlerts)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex h-full items-center justify-center text-sm text-neutral-500 bg-neutral-950/40 rounded-xl border border-dashed border-neutral-800">
                                No active trends logs collected yet.
                            </div>
                        )}
                    </div>
                </div>

                {/* Recent Detections feed list (1/3 width) */}
                <div className="bg-neutral-900 border border-neutral-800/85 rounded-2xl p-6 flex flex-col space-y-4">
                    <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                            <Clock size={16} className="text-indigo-400" />
                            <span>Real-Time Logs</span>
                        </h3>
                        <Link to="/history" className="text-indigo-400 hover:text-indigo-300 text-xs font-semibold">View All</Link>
                    </div>

                    <div className="flex-1 overflow-y-auto max-h-64 space-y-3 pr-1">
                        {recentDetections.length > 0 ? (
                            recentDetections.map((row) => (
                                <div key={row.id} className="p-3 bg-neutral-950 border border-neutral-900/60 rounded-xl flex items-center justify-between text-xs transition duration-150 hover:border-neutral-800">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <span className={`w-2 h-2 rounded-full ${row.status === 'IDENTIFIED' ? 'bg-emerald-500' : 'bg-red-500'
                                                }`}></span>
                                            <span className="font-extrabold text-neutral-200">{row.name}</span>
                                        </div>
                                        <div className="text-[10px] text-neutral-500 flex items-center gap-1.5">
                                            <span>ID #{row.track_id}</span>
                                            <span>•</span>
                                            <span>{row.method}</span>
                                        </div>
                                    </div>

                                    <div className="text-right space-y-1">
                                        <span className="text-[10px] text-neutral-500 font-mono">
                                            {new Date(row.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                        </span>
                                        <div className="text-[9px] text-neutral-400 bg-neutral-900 px-2 py-0.5 rounded font-mono font-bold">
                                            C: {row.face_similarity ? row.face_similarity.toFixed(2) : (row.gait_confidence ? row.gait_confidence.toFixed(2) : '0.0')}
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="flex flex-col h-full items-center justify-center text-sm text-neutral-500 bg-neutral-950/40 rounded-xl border border-dashed border-neutral-800 py-12">
                                No recent logins captured.
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
