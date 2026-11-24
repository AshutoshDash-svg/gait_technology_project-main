import React, { useState, useEffect } from 'react';
import api from '../services/api';
import {
    LineChart,
    Line,
    PieChart,
    Pie,
    Cell,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    Legend,
    ResponsiveContainer
} from 'recharts';
import {
    LineChart as ChartIcon,
    RotateCw,
    Activity,
    Percent,
    AlertOctagon,
    Users
} from 'lucide-react';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

const Analytics = () => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    const fetchAnalytics = async () => {
        setLoading(true);
        try {
            const res = await api.get('/analytics');
            if (res.data.success) {
                setData(res.data.data);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAnalytics();
    }, []);

    if (loading) {
        return (
            <div className="text-center py-20 text-xs text-neutral-500">
                Compiling analytics logs summaries...
            </div>
        );
    }

    if (!data) {
        return (
            <div className="text-center py-20 text-xs text-neutral-500 bg-neutral-900 border border-neutral-800 rounded-2xl p-8">
                Failed to fetch analytics statistics metrics records. Check connection.
            </div>
        );
    }

    // Destructure with default arrays to avoid undefined checks
    const {
        counts = {},
        time_trend = [],
        method_split = [],
        recognition_split = [],
        top_people = []
    } = data;

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8 animate-fadeIn">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-neutral-800 pb-5">
                <div>
                    <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                        <ChartIcon className="text-indigo-500" />
                        <span>Biometric Surveillance Analytics</span>
                    </h2>
                    <p className="text-neutral-400 text-xs mt-1">
                        Performance charts, detection algorithms usage patterns, and anomaly alarms metrics diagnostics.
                    </p>
                </div>

                <button
                    onClick={fetchAnalytics}
                    className="p-2 rounded-xl bg-neutral-905 border border-neutral-800 text-neutral-400 hover:text-white transition flex items-center text-xs font-semibold"
                >
                    <RotateCw size={14} className="mr-1" />
                    <span>Reload Charts</span>
                </button>
            </div>

            {/* Numerical Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5">
                    <span className="text-[10px] uppercase font-bold text-neutral-500">Total Detections</span>
                    <h3 className="text-2xl font-extrabold text-white mt-1">{counts.total_detections || 0}</h3>
                    <span className="text-[9px] text-neutral-500 mt-1 block">Walk passes tallied</span>
                </div>
                <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5">
                    <span className="text-[10px] uppercase font-bold text-neutral-500">Security Alarms</span>
                    <h3 className="text-2xl font-extrabold text-rose-450 mt-1">{counts.total_alerts || 0}</h3>
                    <span className="text-[9px] text-neutral-500 mt-1 block">Unknown detections flagged</span>
                </div>
                <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5">
                    <span className="text-[10px] uppercase font-bold text-neutral-500">Unresolved Threats</span>
                    <h3 className="text-2xl font-extrabold text-amber-500 mt-1">{counts.unresolved_alerts || 0}</h3>
                    <span className="text-[9px] text-neutral-500 mt-1 block">Awaiting verification list details</span>
                </div>
                <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5">
                    <span className="text-[10px] uppercase font-bold text-neutral-500">Identified Profiles</span>
                    <h3 className="text-2xl font-extrabold text-emerald-450 mt-1">{counts.total_people || 0}</h3>
                    <span className="text-[9px] text-neutral-500 mt-1 block">Authorized personnel</span>
                </div>
            </div>

            {/* Main Charts grid layouts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Chronological detection trend */}
                <div className="bg-neutral-900 border border-neutral-850 p-6 rounded-2xl space-y-4">
                    <div>
                        <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                            <Activity size={14} className="text-indigo-400" />
                            <span>Surveillance Traffic Flow</span>
                        </h3>
                        <p className="text-[10px] text-neutral-500">Time-series tracking of authorized passes vs alerts</p>
                    </div>
                    <div className="h-64 pt-2">
                        {time_trend.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={time_trend}>
                                    <XAxis dataKey="time" stroke="#525252" style={{ fontSize: 10 }} tickLine={false} />
                                    <YAxis stroke="#525252" style={{ fontSize: 10 }} tickLine={false} />
                                    <Tooltip contentStyle={{ backgroundColor: '#171717', borderColor: '#2b2b2b' }} />
                                    <Legend wrapperStyle={{ fontSize: 10, paddingTop: 10 }} />
                                    <Line type="monotone" dataKey="detections" name="Total Passes" stroke="#6366f1" strokeWidth={2} activeDot={{ r: 6 }} />
                                    <Line type="monotone" dataKey="alerts" name="Unknown Alarms" stroke="#ef4444" strokeWidth={2} />
                                </LineChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex h-full items-center justify-center text-xs text-neutral-550">
                                Log lists empty. No timeline telemetry.
                            </div>
                        )}
                    </div>
                </div>

                {/* Top Authorized matches */}
                <div className="bg-neutral-900 border border-neutral-850 p-6 rounded-2xl space-y-4">
                    <div>
                        <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                            <Users size={14} className="text-indigo-400" />
                            <span>Top Security Matches</span>
                        </h3>
                        <p className="text-[10px] text-neutral-500">Authorized personnel detections frequency</p>
                    </div>
                    <div className="h-64 pt-2">
                        {top_people.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={top_people} layout="vertical">
                                    <XAxis type="number" stroke="#525252" style={{ fontSize: 10 }} tickLine={false} />
                                    <YAxis dataKey="name" type="category" stroke="#525252" style={{ fontSize: 9 }} tickLine={false} width={80} />
                                    <Tooltip contentStyle={{ backgroundColor: '#171717', borderColor: '#2b2b2b' }} />
                                    <Bar dataKey="count" name="Detections count" fill="#4f46e5" radius={[0, 4, 4, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex h-full items-center justify-center text-xs text-neutral-550">
                                No authorized profile matches recorded.
                            </div>
                        )}
                    </div>
                </div>

                {/* Biometrics decision method breakdown */}
                <div className="bg-neutral-900 border border-neutral-850 p-6 rounded-2xl flex flex-col justify-between">
                    <div className="mb-4">
                        <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                            <Percent size={14} className="text-indigo-400" />
                            <span>Biometric Extraction Method Breakdown</span>
                        </h3>
                        <p className="text-[10px] text-neutral-500">Ratio matching Face embeddings vs Gait Fallback checks</p>
                    </div>
                    <div className="h-56 mt-2 flex items-center justify-center">
                        {method_split.some(m => m.value > 0) ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={method_split}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={50}
                                        outerRadius={80}
                                        paddingAngle={4}
                                        dataKey="value"
                                    >
                                        {method_split.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip contentStyle={{ backgroundColor: '#171717', borderColor: '#2b2b2b' }} />
                                    <Legend layout="horizontal" verticalAlign="bottom" wrapperStyle={{ fontSize: 9 }} />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <span className="text-xs text-neutral-550">No extraction methods logged.</span>
                        )}
                    </div>
                </div>

                {/* Security checks status classification (Identified vs Alerts) */}
                <div className="bg-neutral-900 border border-neutral-850 p-6 rounded-2xl flex flex-col justify-between">
                    <div className="mb-4">
                        <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                            <AlertOctagon size={14} className="text-indigo-400" />
                            <span>Safety Status Distributions</span>
                        </h3>
                        <p className="text-[10px] text-neutral-500">Security alarm classifications percentage</p>
                    </div>
                    <div className="h-56 mt-2 flex items-center justify-center">
                        {recognition_split.some(m => m.value > 0) ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={recognition_split}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={50}
                                        outerRadius={80}
                                        paddingAngle={4}
                                        dataKey="value"
                                    >
                                        {recognition_split.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.name === 'Known Profiles' ? '#10b981' : '#ef4444'} />
                                        ))}
                                    </Pie>
                                    <Tooltip contentStyle={{ backgroundColor: '#171717', borderColor: '#2b2b2b' }} />
                                    <Legend layout="horizontal" verticalAlign="bottom" wrapperStyle={{ fontSize: 9 }} />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <span className="text-xs text-neutral-550">No status distributions logged.</span>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
};

export default Analytics;
