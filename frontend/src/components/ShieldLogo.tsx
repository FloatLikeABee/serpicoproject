import React from 'react';

interface ShieldLogoProps {
  size?: number;
  className?: string;
}

const ShieldLogo: React.FC<ShieldLogoProps> = ({ size = 60, className }) => {
  const gradientId = React.useId().replace(/:/g, '');

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ filter: 'drop-shadow(0 0 10px rgba(62, 198, 255, 0.4))' }}
    >
      <path
        d="M50 10 L20 20 L20 50 Q20 70 35 80 Q50 90 50 90 Q50 90 65 80 Q80 70 80 50 L80 20 Z"
        fill={`url(#${gradientId})`}
        stroke="#3ec6ff"
        strokeWidth="2"
      />
      <path
        d="M50 35 L52 42 L59 42 L53 46 L55 53 L50 48 L45 53 L47 46 L41 42 L48 42 Z"
        fill="#ffc107"
        style={{ filter: 'drop-shadow(0 0 4px rgba(255, 193, 7, 0.55))' }}
      />
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3ec6ff" />
          <stop offset="45%" stopColor="#2f6fd6" />
          <stop offset="100%" stopColor="#0a1f3d" />
        </linearGradient>
      </defs>
    </svg>
  );
};

export default ShieldLogo;
