import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const iconProps = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2.5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

const Navigation: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const isActive = (path: string) =>
    path === '/notes'
      ? location.pathname === '/notes' || location.pathname.startsWith('/notes/')
      : location.pathname === path;

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

  const BoardIcon = () => (
    <svg {...iconProps}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 9h18M9 4v16" />
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

  const NotesIcon = () => (
    <svg {...iconProps}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6M8 13h8M8 17h5" />
    </svg>
  );

  type NavItem = { path: string; label: string; shortLabel: string; icon: JSX.Element };

  const policeNavItems: NavItem[] = [
    { path: '/in-pursue', label: 'Pursue', shortLabel: 'Go', icon: <PursueIcon /> },
    { path: '/chase-game', label: 'Chase', shortLabel: 'Game', icon: <ChaseGameIcon /> },
    { path: '/board', label: 'Board', shortLabel: 'Board', icon: <BoardIcon /> },
  ];

  const civilianNavItems: NavItem[] = [
    { path: '/nearby-officers', label: 'Officers', shortLabel: 'PD', icon: <OfficersIcon /> },
    { path: '/nearby-perps', label: 'Perps', shortLabel: 'Perp', icon: <PerpsCasesIcon /> },
    { path: '/safe-routes', label: 'Routes', shortLabel: 'Map', icon: <RoutesIcon /> },
    { path: '/ai-chat', label: 'AI Chat', shortLabel: 'Chat', icon: <ChatBubbleIcon /> },
  ];

  const navItems = user?.role === 'police' ? policeNavItems : civilianNavItems;

  const navButtonClass = (active: boolean) =>
    `nav-btn flex flex-1 flex-col items-center justify-center gap-0.5 py-1.5 px-0.5 min-w-0 max-w-[4.5rem] rounded-md transition-all touch-manipulation font-display ${
      active ? 'hud-nav-active' : 'text-synth-muted active:scale-95'
    }`;

  const renderNavButton = (path: string, label: string, shortLabel: string, icon: JSX.Element) => (
    <button
      key={path}
      type="button"
      title={label}
      onClick={() => navigate(path)}
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
            {renderNavButton(item.path, item.label, item.shortLabel, item.icon)}
            {user?.role === 'police' && index === 1 &&
              renderNavButton('/ai-chat', 'AI Chat', 'AI', <AIIcon />)
            }
          </React.Fragment>
        ))}

        {renderNavButton('/notes', 'Cases', 'Case', <NotesIcon />)}
      </div>
    </nav>
  );
};

export default Navigation;
