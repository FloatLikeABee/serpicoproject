import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Navigation from '../components/Navigation';
import InPursue from '../pages/police/InPursue';
import Mysteries from '../pages/police/Mysteries';
import ChaseHub from '../pages/police/ChaseHub';
import NearbyOfficers from '../pages/civilian/NearbyOfficers';
import NearbyPerps from '../pages/civilian/NearbyPerps';
import SafeRoutes from '../pages/civilian/SafeRoutes';
import Notes from '../pages/Notes';
import AIChat from '../pages/AIChat';

const Dashboard: React.FC = () => {
  return (
    <div className="app-shell synth-grid-bg synth-scanlines">
      <div className="flex-1 min-h-0 overflow-hidden relative">
        <Routes>
          {/* Police routes */}
          <Route path="/in-pursue" element={<InPursue />} />
          <Route path="/board" element={<Mysteries />} />
          <Route path="/mysteries" element={<Mysteries />} />
          <Route path="/leisure" element={<Mysteries />} />
          <Route path="/chase-game" element={<ChaseHub />} />
          <Route path="/investigation-helper" element={<ChaseHub />} />

          {/* Civilian routes */}
          <Route path="/nearby-officers" element={<NearbyOfficers />} />
          <Route path="/nearby-perps" element={<NearbyPerps />} />
          <Route path="/safe-routes" element={<SafeRoutes />} />

          {/* Common routes */}
          <Route path="/ai-chat" element={<AIChat />} />
          <Route path="/notes" element={<Notes />} />
          <Route path="/notes/:caseId" element={<Notes />} />
          <Route path="/settings" element={<Notes />} />
          <Route path="/" element={<Navigate to="/ai-chat" replace />} />
        </Routes>
      </div>

      <Navigation />
    </div>
  );
};

export default Dashboard;
