import React, { useState, useEffect } from 'react';
import api from '../services/api';
import {
    FolderLock,
    Trash2,
    User,
    Image,
    Video,
    Activity,
    AlertTriangle,
    RefreshCw
} from 'lucide-react';

const DatasetManagement = () => {
    const [persons, setPersons] = useState([]);
    const [loading, setLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState('');
    const [actionFeedback, setActionFeedback] = useState('');

    const fetchPersons = async () => {
        setLoading(true);
        try {
            const res = await api.get('/persons');
            if (res.data.success) {
                setPersons(res.data.data);
                setErrorMsg('');
            }
        } catch (err) {
            console.error(err);
            setErrorMsg("Failed to query dataset listings. Make sure Flask server is online.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPersons();
    }, []);

    const handleDelete = async (pid, name) => {
        if (!window.confirm(`Are you absolutely sure you want to delete the profile: ${name} (${pid})? This removes all associated face images, gait video recordings, and feature array assets.`)) {
            return;
        }

        try {
            const res = await api.delete(`/persons/${pid}`);
            if (res.data.success) {
                setActionFeedback(`Profile ${name} deleted successfully.`);
                fetchPersons();
            }
        } catch (err) {
            console.error(err);
            setActionFeedback(`Failed to delete profile: ${err.response?.data?.error || err.message}`);
        }
    };

    return (
        <div className="p-8 max-w-6xl mx-auto space-y-6 animate-fadeIn">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-neutral-800 pb-5">
                <div>
                    <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                        <FolderLock className="text-indigo-500" />
                        <span>Dataset Catalog Manager</span>
                    </h2>
                    <p className="text-neutral-400 text-xs mt-1">
                        Browse registered identities catalog. Inspect uploaded face pictures, raw walk streams, and AI features status.
                    </p>
                </div>

                <button
                    onClick={fetchPersons}
                    className="p-2 ml-4 rounded-xl bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white transition flex items-center gap-1.5 text-xs font-semibold"
                >
                    <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                    <span>Refresh</span>
                </button>
            </div>

            {errorMsg && (
                <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs rounded-xl flex items-center gap-3">
                    <AlertTriangle size={16} />
                    <span>{errorMsg}</span>
                </div>
            )}

            {actionFeedback && (
                <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs rounded-xl flex justify-between items-center">
                    <span>{actionFeedback}</span>
                    <button onClick={() => setActionFeedback('')} className="text-indigo-400 font-bold hover:text-white">✕</button>
                </div>
            )}

            {loading ? (
                <div className="text-center py-20 text-xs text-neutral-500">
                    Loading catalog profiles...
                </div>
            ) : (
                <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden shadow-lg shadow-neutral-950/20">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                            <thead>
                                <tr className="bg-neutral-950 text-neutral-400 font-semibold border-b border-neutral-800">
                                    <th className="px-6 py-4">ID</th>
                                    <th className="px-6 py-4">Name</th>
                                    <th className="px-6 py-4 text-center">Face Samples</th>
                                    <th className="px-6 py-4 text-center">Gait Videos</th>
                                    <th className="px-6 py-4 text-center">Features Extracted</th>
                                    <th className="px-6 py-4">Registered Date</th>
                                    <th className="px-6 py-4 text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-850/60">
                                {persons.length > 0 ? (
                                    persons.map((p) => (
                                        <tr key={p.id} className="hover:bg-neutral-850/20 transition duration-150">
                                            <td className="px-6 py-4 font-mono font-bold text-neutral-350">{p.person_id}</td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-6 h-6 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center text-neutral-200">
                                                        <User size={12} />
                                                    </div>
                                                    <span className="font-semibold text-white">{p.name}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-center font-semibold text-neutral-400">
                                                <div className="flex items-center justify-center gap-1.5">
                                                    <Image size={12} className="text-neutral-500" />
                                                    <span>{p.face_samples_count}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-center font-semibold text-neutral-400">
                                                <div className="flex items-center justify-center gap-1.5">
                                                    <Video size={12} className="text-neutral-500" />
                                                    <span>{p.gait_videos_count}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <div className="flex items-center justify-center gap-2">
                                                    <span className={`inline-block w-2 h-2 rounded-full ${p.face_samples_count > 0 && p.gait_videos_count == p.gait_features_count
                                                            ? 'bg-emerald-500'
                                                            : 'bg-amber-500'
                                                        }`}></span>
                                                    <span className="text-[10px] text-neutral-500">
                                                        {p.gait_features_count}/{p.gait_videos_count} Gait
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-neutral-500">
                                                {new Date(p.created_at).toLocaleDateString()}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <button
                                                    onClick={() => handleDelete(p.person_id, p.name)}
                                                    className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500 hover:text-white transition duration-150"
                                                >
                                                    <Trash2 size={13} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="7" className="text-center py-16 text-neutral-500 font-semibold">
                                            No profiles registered yet. Start by creating a profile outline in "Register Person".
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DatasetManagement;
