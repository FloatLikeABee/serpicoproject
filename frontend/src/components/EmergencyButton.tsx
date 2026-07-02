import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const EmergencyButton: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isPulsing, setIsPulsing] = useState(true);
  
  const isEmergencyPage = location.pathname === '/emergency';

  const handleClick = () => {
    if (isEmergencyPage) {
      navigate('/in-pursue');
    } else {
      navigate('/emergency');
    }
  };

  return (
    <button
      onClick={handleClick}
      className={`fixed top-3 right-3 sm:top-4 sm:right-4 z-50 rounded-full p-3 sm:p-4 transition-all active:scale-95 touch-manipulation font-display ${
        isEmergencyPage
          ? 'bg-synth-panel border border-neon-purple/50 text-synth-muted'
          : 'btn-neon-danger border-2 border-neon-magenta/60 animate-neon-pulse'
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
        boxShadow: isEmergencyPage ? undefined : '0 0 20px rgba(255, 43, 214, 0.6), 0 0 40px rgba(123, 47, 247, 0.3)',
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
        <circle cx="12" cy="10" r="7" />
        <ellipse cx="12" cy="17" rx="7" ry="2" />
        <path d="M5 5l1 1M19 5l-1 1M5 19l1-1M19 19l-1-1" strokeWidth="1.5" />
        <circle cx="5" cy="5" r="0.5" fill="currentColor" />
        <circle cx="19" cy="5" r="0.5" fill="currentColor" />
        <circle cx="5" cy="19" r="0.5" fill="currentColor" />
        <circle cx="19" cy="19" r="0.5" fill="currentColor" />
        <circle cx="12" cy="10" r="3" fill="currentColor" opacity="0.3" />
      </svg>
    </button>
  );
};

export default EmergencyButton;
