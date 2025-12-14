import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';

const EmergencyButton: React.FC = () => {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [isPulsing, setIsPulsing] = useState(true);
  
  const isEmergencyPage = location.pathname === '/emergency';

  const handleClick = () => {
    if (isEmergencyPage) {
      // If on emergency page, navigate back to default (Pursue for police)
      navigate('/in-pursue');
    } else {
      // Otherwise, navigate to emergency page
      navigate('/emergency');
    }
  };

  return (
    <button
      onClick={handleClick}
      className={`fixed top-4 right-4 z-50 ${
        isEmergencyPage 
          ? 'bg-gray-600 hover:bg-gray-700' 
          : 'bg-red-600 hover:bg-red-700'
      } text-white rounded-full p-4 shadow-2xl transition-all transform hover:scale-110 ${
        isPulsing && !isEmergencyPage ? 'animate-pulse' : ''
      }`}
      onMouseEnter={() => setIsPulsing(false)}
      onMouseLeave={() => !isEmergencyPage && setIsPulsing(true)}
      style={{
        width: '64px',
        height: '64px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      title={isEmergencyPage ? 'Close Emergency Panel' : 'Open Emergency / 911 Dispatch'}
    >
      <svg
        width="32"
        height="32"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    </button>
  );
};

export default EmergencyButton;

