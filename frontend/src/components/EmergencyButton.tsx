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
      className={`fixed top-3 right-3 sm:top-4 sm:right-4 z-50 ${
        isEmergencyPage 
          ? 'bg-gray-600 active:bg-gray-700' 
          : 'bg-red-600 active:bg-red-700'
      } text-white rounded-full p-3 sm:p-4 shadow-2xl transition-all active:scale-95 touch-manipulation ${
        isPulsing && !isEmergencyPage ? 'animate-pulse' : ''
      }`}
      onTouchStart={() => setIsPulsing(false)}
      onMouseEnter={() => setIsPulsing(false)}
      onMouseLeave={() => !isEmergencyPage && setIsPulsing(true)}
      style={{
        width: '56px',
        height: '56px',
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

