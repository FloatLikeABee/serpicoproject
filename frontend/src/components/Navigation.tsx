import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import AIChatModal from './AIChatModal';

interface NavigationProps {
  onChatClick?: () => void;
}

const iconProps = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2.5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

const Navigation: React.FC<NavigationProps> = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [isAIChatModalOpen, setIsAIChatModalOpen] = useState(false);

  const isActive = (path: string) => location.pathname === path;

  const PursueIcon = () => (
    <svg {...iconProps}>
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
      <circle cx="12" cy="9" r="2.5" fill="currentColor" />
    </svg>
  );

  const AIIcon = () => (
    <svg {...iconProps}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v12M6 12h12" />
      <circle cx="12" cy="12" r="2.5" fill="currentColor" />
    </svg>
  );

  const PerpsCasesIcon = () => (
    <svg {...iconProps}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M9 9h6M9 15h6" />
    </svg>
  );

  const MysteriesIcon = () => (
    <svg {...iconProps}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6M8 10h8" />
    </svg>
  );

  const ChaseGameIcon = () => (
    <svg {...iconProps}>
      <path d="M5 17h14l-1.5-4.5H6.5L5 17z" />
      <circle cx="7.5" cy="17.5" r="1.5" fill="currentColor" />
      <circle cx="16.5" cy="17.5" r="1.5" fill="currentColor" />
    </svg>
  );

  const OfficersIcon = () => (
    <svg {...iconProps}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
    </svg>
  );

  const RoutesIcon = () => (
    <svg {...iconProps}>
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" fill="currentColor" />
    </svg>
  );

  const ChatBubbleIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );

  const SettingsIcon = () => (
    <svg {...iconProps}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1v3m0 16v3M5.64 5.64l2.12 2.12m8.48 8.48l2.12 2.12M1 12h3m16 0h3" />
    </svg>
  );

  type NavItem = { path: string; label: string; shortLabel: string; icon: JSX.Element; isModal?: boolean };

  const policeNavItems: NavItem[] = [
    { path: '/in-pursue', label: 'Pursue', shortLabel: 'Go', icon: <PursueIcon /> },
    { path: '/perps-cases', label: 'Records', shortLabel: 'Rec', icon: <PerpsCasesIcon /> },
    { path: '/chase-game', label: 'Chase', shortLabel: 'Game', icon: <ChaseGameIcon /> },
    { path: '/mysteries', label: 'Mysteries', shortLabel: 'Myst', icon: <MysteriesIcon /> },
  ];

  const civilianNavItems: NavItem[] = [
    { path: '/nearby-officers', label: 'Officers', shortLabel: 'PD', icon: <OfficersIcon /> },
    { path: '/nearby-perps', label: 'Perps', shortLabel: 'Perp', icon: <PerpsCasesIcon /> },
    { path: '/safe-routes', label: 'Routes', shortLabel: 'Map', icon: <RoutesIcon /> },
    { path: '/crime-notifications', label: 'AI Chat', shortLabel: 'Chat', icon: <ChatBubbleIcon />, isModal: true },
  ];

  const navItems = user?.role === 'police' ? policeNavItems : civilianNavItems;

  const navButtonClass = (active: boolean) =>
    `nav-btn flex flex-1 flex-col items-center justify-center gap-0.5 py-1.5 px-0.5 min-w-0 max-w-[4.5rem] rounded-md transition-all touch-manipulation font-display ${
      active ? 'hud-nav-active' : 'text-synth-muted active:scale-95'
    }`;

  const renderNavButton = (path: string, label: string, shortLabel: string, icon: JSX.Element, onClick?: () => void) => (
    <button
      key={path}
      type="button"
      title={label}
      onClick={onClick ?? (() => navigate(path))}
      className={navButtonClass(isActive(path))}
    >
      <span className="flex-shrink-0">{icon}</span>
      <span className="text-[9px] sm:text-[10px] font-semibold leading-none tracking-wide uppercase truncate w-full text-center hidden min-[360px]:block">
        {label}
      </span>
      <span className="text-[9px] font-semibold leading-none tracking-wide uppercase min-[360px]:hidden">
        {shortLabel}
      </span>
    </button>
  );

  return (
    <nav className="hud-nav z-30">
      <div className="absolute top-0 left-2 right-2 h-px bg-gradient-to-r from-transparent via-neon-cyan/50 to-transparent" />
      <div className="flex items-stretch justify-between gap-0 px-0.5 py-1 max-w-[100vw] overflow-hidden">
        {navItems.map((item, index) => (
          <React.Fragment key={item.path}>
            {renderNavButton(
              item.path,
              item.label,
              item.shortLabel,
              item.icon,
              item.isModal ? () => setIsAIChatModalOpen(true) : undefined
            )}
            {user?.role === 'police' && index === 0 &&
              renderNavButton('/ai-chat', 'AI Chat', 'AI', <AIIcon />)
            }
          </React.Fragment>
        ))}

        {user?.role !== 'police' &&
          renderNavButton('/ai-chat', 'AI Chat', 'AI', <AIIcon />)
        }

        {renderNavButton('/settings', 'Settings', 'Cfg', <SettingsIcon />)}
      </div>

      <AIChatModal isOpen={isAIChatModalOpen} onClose={() => setIsAIChatModalOpen(false)} />
    </nav>
  );
};

export default Navigation;
