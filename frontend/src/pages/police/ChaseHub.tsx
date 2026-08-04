import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import ChaseGame from './ChaseGame';
import InvestigationHelper from './InvestigationHelper';

type HubTab = 'investigation' | 'chase';

const ChaseHub: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const tabFromPath = useMemo<HubTab>(() => {
    if (location.pathname.includes('investigation')) return 'investigation';
    if (location.search.includes('tab=chase')) return 'chase';
    return 'investigation';
  }, [location.pathname, location.search]);

  const [tab, setTab] = useState<HubTab>(tabFromPath);

  useEffect(() => {
    setTab(tabFromPath);
  }, [tabFromPath]);

  const selectTab = (next: HubTab) => {
    setTab(next);
    if (next === 'chase') {
      navigate('/chase-game?tab=chase', { replace: true });
    } else {
      navigate('/chase-game', { replace: true });
    }
  };
  return (
    <div className="page-fill bg-synth-void">
      <div className="game-header flex-shrink-0 px-2.5 py-1.5 border-b border-white/10">
        <div
          className="flex p-0.5 rounded-lg border border-white/10 bg-black/40"
          role="tablist"
          aria-label="Chase desk modules"
        >
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'investigation'}
            onClick={() => selectTab('investigation')}
            className={`flex-1 px-2 py-1.5 rounded-md text-[11px] sm:text-xs font-semibold touch-manipulation ${
              tab === 'investigation'
                ? 'bg-serpico-blue text-white'
                : 'text-synth-muted active:bg-white/5'
            }`}
          >
            Investigation Helper
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'chase'}
            onClick={() => selectTab('chase')}
            className={`flex-1 px-2 py-1.5 rounded-md text-[11px] sm:text-xs font-semibold touch-manipulation ${
              tab === 'chase' ? 'bg-serpico-blue text-white' : 'text-synth-muted active:bg-white/5'
            }`}
          >
            Chase Game
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        {tab === 'investigation' ? <InvestigationHelper /> : <ChaseGame />}
      </div>
    </div>
  );
};

export default ChaseHub;
