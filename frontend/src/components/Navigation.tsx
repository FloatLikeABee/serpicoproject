import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

interface NavigationProps {
  onChatClick?: () => void;
}

const Navigation: React.FC<NavigationProps> = ({ onChatClick }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { theme } = useTheme();

  const isActive = (path: string) => location.pathname === path;

  // Fancy abstract icon components
  const PursueIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
      <circle cx="12" cy="9" r="2.5" fill="currentColor" />
      <path d="M8 15l4-4 4 4" />
    </svg>
  );

  const AIIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v12M6 12h12" />
      <circle cx="12" cy="12" r="3" fill="currentColor" />
    </svg>
  );

  const PerpsCasesIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M9 9h6M9 15h6M9 12h6" />
      <circle cx="7" cy="7" r="1" fill="currentColor" />
      <circle cx="17" cy="17" r="1" fill="currentColor" />
    </svg>
  );

  const LeisureIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2L2 7l10 5 10-5-10-5z" />
      <path d="M2 17l10 5 10-5" />
      <path d="M2 12l10 5 10-5" />
      <circle cx="12" cy="12" r="2" fill="currentColor" />
    </svg>
  );

  const OfficersIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );

  const RoutesIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" fill="currentColor" />
      <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
    </svg>
  );

  const AlertsIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" strokeWidth="3" />
      <circle cx="12" cy="17" r="1" fill="currentColor" />
    </svg>
  );

  const SettingsIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1v6m0 6v6M5.64 5.64l4.24 4.24m4.24 4.24l4.24 4.24M1 12h6m6 0h6M5.64 18.36l4.24-4.24m4.24-4.24l4.24-4.24" />
    </svg>
  );

  const policeNavItems = [
    { path: '/in-pursue', label: 'Pursue', icon: <PursueIcon /> },
    { path: '/perps-cases', label: 'Records', icon: <PerpsCasesIcon /> },
    { path: '/leisure', label: 'Leisure', icon: <LeisureIcon /> },
  ];

  const civilianNavItems = [
    { path: '/nearby-officers', label: 'Officers', icon: <OfficersIcon /> },
    { path: '/nearby-perps', label: 'Perps', icon: <PerpsCasesIcon /> },
    { path: '/safe-routes', label: 'Routes', icon: <RoutesIcon /> },
    { path: '/crime-notifications', label: 'Alerts', icon: <AlertsIcon /> },
  ];

  const navItems = user?.role === 'police' ? policeNavItems : civilianNavItems;

  return (
    <nav className={`fixed bottom-0 left-0 right-0 ${
      theme === 'dark' ? 'bg-gray-800' : 'bg-white'
    } border-t ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'} z-30`}>
      <div className="flex items-center justify-around px-2 py-2">
        {navItems.map((item, index) => (
          <React.Fragment key={item.path}>
            <button
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center justify-center px-3 py-2 rounded-lg transition-colors ${
                isActive(item.path)
                  ? 'text-serpico-blue bg-serpico-blue bg-opacity-10'
                  : theme === 'dark'
                  ? 'text-gray-400 hover:text-gray-200'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <span className="mb-1">{item.icon}</span>
              <span className="text-xs font-medium">{item.label}</span>
            </button>
            {/* Insert AI Chat button right after Pursue (first item for police) */}
            {user?.role === 'police' && index === 0 && (
              <button
                onClick={() => navigate('/ai-chat')}
                className={`flex flex-col items-center justify-center px-3 py-2 rounded-lg transition-colors ${
                  isActive('/ai-chat')
                    ? 'text-serpico-blue bg-serpico-blue bg-opacity-10'
                    : theme === 'dark'
                    ? 'text-gray-400 hover:text-gray-200'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <span className="mb-1"><AIIcon /></span>
                <span className="text-xs font-medium">AI Chat</span>
              </button>
            )}
          </React.Fragment>
        ))}
        
        {/* AI Chat button for civilians (after all nav items) */}
        {user?.role !== 'police' && (
          <button
            onClick={() => navigate('/ai-chat')}
            className={`flex flex-col items-center justify-center px-3 py-2 rounded-lg transition-colors ${
              isActive('/ai-chat')
                ? 'text-serpico-blue bg-serpico-blue bg-opacity-10'
                : theme === 'dark'
                ? 'text-gray-400 hover:text-gray-200'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <span className="mb-1"><AIIcon /></span>
            <span className="text-xs font-medium">AI Chat</span>
          </button>
        )}

        <button
          onClick={() => navigate('/settings')}
          className={`flex flex-col items-center justify-center px-3 py-2 rounded-lg transition-colors ${
            isActive('/settings')
              ? 'text-serpico-blue bg-serpico-blue bg-opacity-10'
              : theme === 'dark'
              ? 'text-gray-400 hover:text-gray-200'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <span className="mb-1"><SettingsIcon /></span>
          <span className="text-xs font-medium">Settings</span>
        </button>
      </div>
    </nav>
  );
};

export default Navigation;

