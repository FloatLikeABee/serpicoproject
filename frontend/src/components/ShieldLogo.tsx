import React from 'react';

interface ShieldLogoProps {
  size?: number;
}

const ShieldLogo: React.FC<ShieldLogoProps> = ({ size = 60 }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Shield shape */}
      <path
        d="M50 10 L20 20 L20 50 Q20 70 35 80 Q50 90 50 90 Q50 90 65 80 Q80 70 80 50 L80 20 Z"
        fill="url(#shieldGradient)"
        stroke="#1E40AF"
        strokeWidth="2"
      />
      {/* Star in center */}
      <path
        d="M50 35 L52 42 L59 42 L53 46 L55 53 L50 48 L45 53 L47 46 L41 42 L48 42 Z"
        fill="#DC2626"
      />
      <defs>
        <linearGradient id="shieldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#2563EB" />
          <stop offset="50%" stopColor="#3B82F6" />
          <stop offset="100%" stopColor="#DC2626" />
        </linearGradient>
      </defs>
    </svg>
  );
};

export default ShieldLogo;

