import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import Navigation from '../components/Navigation';
import InPursue from '../pages/police/InPursue';
import Mysteries from '../pages/police/Mysteries';
import ChaseGame from '../pages/police/ChaseGame';
import NearbyOfficers from '../pages/civilian/NearbyOfficers';
import NearbyPerps from '../pages/civilian/NearbyPerps';
import SafeRoutes from '../pages/civilian/SafeRoutes';
import Notes from '../pages/Notes';
import AIChat from '../pages/AIChat';

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const { theme } = useTheme();

  const getDefaultView = () => {
    if (user?.role === 'police') {
      return <InPursue />;
    }
    return <NearbyOfficers />;
  };

  return (
    <div className={`app-shell synth-grid-bg synth-scanlines ${theme === 'dark' ? '' : 'synth-light'}`}>
      <div className="flex-1 min-h-0 overflow-hidden relative">
        <Routes>
          {/* Police routes */}
          <Route path="/in-pursue" element={<InPursue />} />
          <Route path="/board" element={<Mysteries />} />
          <Route path="/mysteries" element={<Mysteries />} />
          <Route path="/leisure" element={<Mysteries />} />
          <Route path="/chase-game" element={<ChaseGame />} />

          {/* Civilian routes */}
          <Route path="/nearby-officers" element={<NearbyOfficers />} />
          <Route path="/nearby-perps" element={<NearbyPerps />} />
          <Route path="/safe-routes" element={<SafeRoutes />} />

          {/* Common routes */}
          <Route path="/ai-chat" element={<AIChat />} />
          <Route path="/notes" element={<Notes />} />
          <Route path="/notes/:caseId" element={<Notes />} />
          <Route path="/settings" element={<Notes />} />
          <Route path="/" element={getDefaultView()} />
        </Routes>
      </div>

      <Navigation />
    </div>
  );
};

export default Dashboard;
