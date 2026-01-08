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
      title={isEmergencyPage ? 'Close Alerts Panel' : 'Open Alerts & Notifications'}
    >
      <svg
        width="32"
        height="32"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* Crystal ball with sparkles - fun mystery icon */}
        <circle cx="12" cy="10" r="7" />
        <ellipse cx="12" cy="17" rx="7" ry="2" />
        {/* Sparkles around the ball */}
        <path d="M5 5l1 1M19 5l-1 1M5 19l1-1M19 19l-1-1" strokeWidth="1.5" />
        <circle cx="5" cy="5" r="0.5" fill="currentColor" />
        <circle cx="19" cy="5" r="0.5" fill="currentColor" />
        <circle cx="5" cy="19" r="0.5" fill="currentColor" />
        <circle cx="19" cy="19" r="0.5" fill="currentColor" />
        {/* Inner glow */}
        <circle cx="12" cy="10" r="3" fill="currentColor" opacity="0.3" />
      </svg>
    </button>
  );
};

export default EmergencyButton;

