import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import Navigation from '../components/Navigation';
import InPursue from '../pages/police/InPursue';
import PerpsAndCases from '../pages/police/PerpsAndCases';
import Emergency from '../pages/police/Emergency';
import Leisure from '../pages/police/Leisure';
import EmergencyButton from '../components/EmergencyButton';
import NearbyOfficers from '../pages/civilian/NearbyOfficers';
import NearbyPerps from '../pages/civilian/NearbyPerps';
import SafeRoutes from '../pages/civilian/SafeRoutes';
import CrimeNotifications from '../pages/civilian/CrimeNotifications';
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
            <Route path="/leisure" element={<Leisure />} />
            
            {/* Civilian routes */}
            <Route path="/nearby-officers" element={<NearbyOfficers />} />
            <Route path="/nearby-perps" element={<NearbyPerps />} />
            <Route path="/safe-routes" element={<SafeRoutes />} />
            <Route path="/crime-notifications" element={<CrimeNotifications />} />
            
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

