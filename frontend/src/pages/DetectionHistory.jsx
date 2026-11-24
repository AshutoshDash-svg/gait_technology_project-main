import React, { useState, useEffect } from 'react';
import api from '../services/api';
import {
    History,
    Search,
    RotateCw,
    Camera,
    Layers,
    ShieldCheck,
    AlertOctagon,
    ChevronLeft,
    ChevronRight
} from 'lucide-react';

const DetectionHistory = () => {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [totalRecords, setTotalRecords] = useState(0);
    const [pageOffset, setPageOffset] = useState(0);
    const limitValue = 15;

    // Filter states
    const [filterStatus, setFilterStatus] = useState('');
    const [filterMethod, setFilterMethod] = useState('');
    const [searchName, setSearchName] = useState('');

    const fetchHistory = async () => {
        setLoading(true);
        try {
            // Build query params
            const params = new URLSearchParams();
            params.append('limit', limitValue.toString());
            params.append('offset', pageOffset.toString());

            if (filterStatus) params.append('status', filterStatus);
            if (filterMethod) params.append('method', filterMethod);
            // Wait, we query by person_id or search values. The backend supports person_id. For prototype, we do local name filtering if searchName is set or we pass it
            // Let's implement local name search to make it fast or filter

            const res = await api.get(`/detections?${params.toString()}`);
            if (res.data.success) {
                setLogs(res.data.data);
                setTotalRecords(res.data.pagination.total);
            }
        } catch (e) {
            console.error("Failed to load historical logs:", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchHistory();
    }, [pageOffset, filterStatus, filterMethod]);

    const handleSearchTrigger = (e) => {
        e.preventDefault();
        setPageOffset(0);
        fetchHistory();
    };

    const handleReset = () => {
        setFilterStatus('');
        setFilterMethod('');
        setSearchName('');
        setPageOffset(0);
    };

    // Local filter subset for names matching search text
    const filteredLogs = logs.filter(row =>
        row.name.toLowerCase().includes(searchName.toLowerCase()) ||
        (row.person_id && row.person_id.toLowerCase().includes(searchName.toLowerCase())) ||
        row.track_id.toString().includes(searchName)
    );

    return (
        <div className="p-8 max-w-6xl mx-auto space-y-6 animate-fadeIn">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-neutral-800 pb-5">
                <div>
                    <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                        <History className="text-indigo-500" />
                        <span>Surveillance Detection Logs</span>
                    </h2>
                    <p className="text-neutral-400 text-xs mt-1">
                        Display running logs recorded by CCTV cameras, detailing confidence, timestamps, and classifications.
                    </p>
                </div>

                <button
                    onClick={fetchHistory}
                    className="p-2 ml-4 rounded-xl bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white transition flex items-center gap-1.5 text-xs font-semibold"
                >
                    <RotateCw size={14} className={loading ? 'animate-spin' : ''} />
                    <span>Reload logs</span>
                </button>
            </div>

            {/* Filter controls panel */}
            <form onSubmit={handleSearchTrigger} className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 gap-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 items-end">
                <div>
                    <label className="block text-[10px] font-semibold text-neutral-400 uppercase mb-2">Search target</label>
                    <div className="relative">
                        <input
                            type="text"
                            value={searchName}
                            onChange={(e) => setSearchName(e.target.value)}
                            placeholder="Name, track ID or profile ID"
                            className="w-full px-3.5 py-2 pl-9 bg-neutral-950 border border-neutral-850 rounded-xl text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-indigo-650"
                        />
                        <Search className="absolute left-3 top-2.5 text-neutral-600" size={14} />
                    </div>
                </div>

                <div>
                    <label className="block text-[10px] font-semibold text-neutral-400 uppercase mb-2 font-bold">Method</label>
                    <select
                        value={filterMethod}
                        onChange={(e) => { setFilterMethod(e.target.value); setPageOffset(0); }}
                        className="w-full px-3 py-2 bg-neutral-950 border border-neutral-850 rounded-xl text-xs text-neutral-300 focus:outline-none focus:border-indigo-650"
                    >
                        <option value="">All strategies</option>
                        <option value="Face Recognition">Face Recognition</option>
                        <option value="Gait Recognition">Gait Recognition</option>
                        <option value="Multimodal (Rejected)">Multimodal (Rejected)</option>
                        <option value="None">None</option>
                    </select>
                </div>

                <div>
                    <label className="block text-[10px] font-semibold text-neutral-400 uppercase mb-2">Alert Status</label>
                    <select
                        value={filterStatus}
                        onChange={(e) => { setFilterStatus(e.target.value); setPageOffset(0); }}
                        className="w-full px-3 py-2 bg-neutral-950 border border-neutral-850 rounded-xl text-xs text-neutral-300 focus:outline-none focus:border-indigo-650"
                    >
                        <option value="">All statuses</option>
                        <option value="IDENTIFIED">IDENTIFIED (All)</option>
                        <option value="IDENTIFIED(masks)">IDENTIFIED (Masks)</option>
                        <option value="ALERT">ALERT (Unknowns)</option>
                        <option value="PROCESSING">PROCESSING</option>
                    </select>
                </div>

                <div>
                    <button
                        type="button"
                        onClick={handleReset}
                        className="w-full py-2 rounded-xl border border-neutral-850 bg-neutral-950 text-neutral-450 hover:bg-neutral-850 text-xs font-semibold"
                    >
                        Clear Filters
                    </button>
                </div>
            </form>

            {/* Main Table view */}
            {loading ? (
                <div className="text-center py-20 text-xs text-neutral-500">
                    Loading log histories...
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse text-xs">
                                <thead>
                                    <tr className="bg-neutral-950 text-neutral-400 font-semibold border-b border-neutral-800">
                                        <th className="px-6 py-4">Timestamp</th>
                                        <th className="px-6 py-4">Camera</th>
                                        <th className="px-6 py-4">Track ID</th>
                                        <th className="px-6 py-4">Identified Profile</th>
                                        <th className="px-6 py-4">Decision Strategy</th>
                                        <th className="px-6 py-4 text-center">Confidence</th>
                                        <th className="px-6 py-4 text-center">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-neutral-850/60">
                                    {filteredLogs.length > 0 ? (
                                        filteredLogs.map((row) => (
                                            <tr key={row.id} className="hover:bg-neutral-850/20 transition duration-150">
                                                <td className="px-6 py-4 text-neutral-405 font-mono text-[10px]">
                                                    {new Date(row.timestamp).toLocaleString()}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-1.5 text-neutral-250">
                                                        <Camera size={13} className="text-neutral-500" />
                                                        <span>{row.camera}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 font-mono font-bold text-neutral-350"># {row.track_id}</td>
                                                <td className="px-6 py-4">
                                                    <div className="space-y-0.5">
                                                        <span className="font-semibold text-white block">{row.name}</span>
                                                        {row.person_id && (
                                                            <span className="text-[10px] text-neutral-500 font-mono">{row.person_id}</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-1.5">
                                                        <Layers size={13} className="text-neutral-500" />
                                                        <span className="text-indigo-400 font-medium">{row.method}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-center font-mono font-bold text-neutral-300">
                                                    {row.face_similarity ? row.face_similarity.toFixed(2) : (row.gait_confidence ? row.gait_confidence.toFixed(2) : '0.0')}
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <div className="flex items-center justify-center">
                                                        {row.status && row.status.startsWith('IDENTIFIED') ? (
                                                            <span className="flex items-center gap-1 px-2.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-bold text-[9px]">
                                                                <ShieldCheck size={10} />
                                                                <span>{row.status}</span>
                                                            </span>
                                                        ) : (
                                                            <span className={`flex items-center gap-1 px-2.5 py-0.5 rounded font-bold text-[9px] ${row.status === 'PROCESSING' ? 'bg-amber-500/10 text-amber-400 animate-pulse' : 'bg-red-500/10 text-rose-400 animate-pulse'}`}>
                                                                <AlertOctagon size={10} />
                                                                <span>{row.status || 'ALERT'}</span>
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan="7" className="text-center py-16 text-neutral-500 font-semibold">
                                                No detection records match current search parameters.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Pagination controls */}
                    <div className="flex justify-between items-center text-xs text-neutral-400">
                        <span>Showing {filteredLogs.length} of {totalRecords} total entries</span>

                        <div className="flex gap-2">
                            <button
                                disabled={pageOffset === 0}
                                onClick={() => setPageOffset(prev => Math.max(0, prev - limitValue))}
                                className="p-1 px-2 rounded bg-neutral-900 border border-neutral-800 disabled:opacity-45 hover:bg-neutral-850 text-white"
                            >
                                <ChevronLeft size={16} />
                            </button>
                            <button
                                disabled={pageOffset + limitValue >= totalRecords}
                                onClick={() => setPageOffset(prev => prev + limitValue)}
                                className="p-1 px-2 rounded bg-neutral-900 border border-neutral-800 disabled:opacity-45 hover:bg-neutral-850 text-white"
                            >
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DetectionHistory;
