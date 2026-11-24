import React from 'react';
import { NavLink } from 'react-router-dom';
import {
    LayoutDashboard,
    Tv,
    UserPlus,
    FolderLock,
    Cpu,
    Settings2,
    History,
    AlertTriangle,
    LineChart
} from 'lucide-react';


const Sidebar = () => {
    const menuItems = [
        { path: '/', label: 'Dashboard', icon: LayoutDashboard },
        { path: '/live', label: 'Live Monitor', icon: Tv },
        { path: '/register', label: 'Register Person', icon: UserPlus },
        { path: '/dataset', label: 'Dataset Management', icon: FolderLock },
        { path: '/training', label: 'Training Center', icon: Cpu },
        { path: '/models', label: 'Model Management', icon: Settings2 },
        { path: '/history', label: 'Detection History', icon: History },
        { path: '/alerts', label: 'Unknown Alerts', icon: AlertTriangle },
        { path: '/analytics', label: 'Analytics', icon: LineChart },
    ];

    return (
        <aside className="w-64 bg-neutral-900 border-r border-neutral-800 flex flex-col h-screen sticky top-0">
            {/* Header Banner */}
            <div className="p-6 border-b border-neutral-800 bg-neutral-950 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-600/30">
                    A
                </div>
                <div>
                    <h1 className="font-extrabold text-white text-md tracking-tight leading-none">AEGIS SURVEILLANCE</h1>
                    <span className="text-[10px] text-indigo-400 font-semibold tracking-widest uppercase">Multi-Modal AI Hub</span>
                </div>
            </div>

            {/* Navigation List */}
            <nav className="flex-1 overflow-y-auto p-4 space-y-1">
                {menuItems.map((item) => {
                    const Icon = item.icon;
                    return (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            className={({ isActive }) =>
                                `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-150 ${isActive
                                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/10'
                                    : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60'
                                }`
                            }
                        >
                            <Icon size={18} />
                            <span>{item.label}</span>
                        </NavLink>
                    );
                })}
            </nav>

            {/* Footer Info */}
            <div className="p-4 border-t border-neutral-800 bg-neutral-950 text-center">
                <div className="flex items-center justify-center gap-2 mb-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span className="text-xs text-neutral-400 font-semibold">CORE SECURE</span>
                </div>
                <span className="text-[10px] text-neutral-500 font-medium">Node Version: v24.12.0</span>
            </div>
        </aside>
    );
};

export default Sidebar;
