import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import Navigation from '../components/Navigation';
import InPursue from '../pages/police/InPursue';
import PerpsAndCases from '../pages/police/PerpsAndCases';
import Emergency from '../pages/police/Emergency';
import Mysteries from '../pages/police/Mysteries';
import ChaseGame from '../pages/police/ChaseGame';
import EmergencyButton from '../components/EmergencyButton';
import NearbyOfficers from '../pages/civilian/NearbyOfficers';
import NearbyPerps from '../pages/civilian/NearbyPerps';
import SafeRoutes from '../pages/civilian/SafeRoutes';
import Settings from '../pages/Settings';
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
    <div className={`min-h-screen ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <div className="flex flex-col h-screen">
        {/* Main content area */}
        <div className="flex-1 relative overflow-hidden">
          <Routes>
            {/* Police routes */}
            <Route path="/in-pursue" element={<InPursue />} />
            <Route path="/perps-cases" element={<PerpsAndCases />} />
            <Route path="/perps" element={<PerpsAndCases />} />
            <Route path="/case-library" element={<PerpsAndCases />} />
            <Route path="/emergency" element={<Emergency />} />
            <Route path="/mysteries" element={<Mysteries />} />
            <Route path="/leisure" element={<Mysteries />} />
            <Route path="/chase-game" element={<ChaseGame />} />
            
            {/* Civilian routes */}
            <Route path="/nearby-officers" element={<NearbyOfficers />} />
            <Route path="/nearby-perps" element={<NearbyPerps />} />
            <Route path="/safe-routes" element={<SafeRoutes />} />
            {/* crime-notifications route redirects - now opens modal via Navigation */}
            <Route path="/crime-notifications" element={<Navigate to="/" replace />} />
            
            {/* Common routes */}
            <Route path="/ai-chat" element={<AIChat />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/" element={getDefaultView()} />
          </Routes>
        </div>

        {/* Emergency Button - Overlay */}
        {user?.role === 'police' && <EmergencyButton />}

        {/* Navigation */}
        <Navigation />
      </div>
    </div>
  );
};

export default Dashboard;

