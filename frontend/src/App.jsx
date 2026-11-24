import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import LiveMonitor from './pages/LiveMonitor';
import RegisterPerson from './pages/RegisterPerson';
import DatasetManagement from './pages/DatasetManagement';
import TrainingCenter from './pages/TrainingCenter';
import ModelManagement from './pages/ModelManagement';
import DetectionHistory from './pages/DetectionHistory';
import Alerts from './pages/Alerts';
import Analytics from './pages/Analytics';

function App() {
  return (
    <Router>
      <div className="flex min-h-screen bg-neutral-950 text-neutral-100">
        <Sidebar aria-label="Main Navigation" />

        {/* Main Content Area */}
        <main className="flex-1 min-w-0 overflow-y-auto" aria-label="Dashboard Content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/live" element={<LiveMonitor />} />
            <Route path="/register" element={<RegisterPerson />} />
            <Route path="/dataset" element={<DatasetManagement />} />
            <Route path="/training" element={<TrainingCenter />} />
            <Route path="/models" element={<ModelManagement />} />
            <Route path="/history" element={<DetectionHistory />} />
            <Route path="/alerts" element={<Alerts />} />
            <Route path="/analytics" element={<Analytics />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
