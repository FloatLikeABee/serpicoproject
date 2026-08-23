import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import FleetMap from './FleetMap';
import InvestigationHelper from './InvestigationHelper';

type HubTab = 'investigation' | 'fleet';

const ChaseHub: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const tabFromPath = useMemo<HubTab>(() => {
    if (location.pathname.includes('investigation')) return 'investigation';
    if (location.search.includes('tab=investigation')) return 'investigation';
    if (location.search.includes('tab=chase') || location.search.includes('tab=fleet')) return 'fleet';
    return 'fleet';
  }, [location.pathname, location.search]);

  const [tab, setTab] = useState<HubTab>(tabFromPath);

  useEffect(() => {
    setTab(tabFromPath);
  }, [tabFromPath]);

  const selectTab = (next: HubTab) => {
    setTab(next);
    if (next === 'investigation') {
      navigate('/investigation-helper', { replace: true });
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
          aria-label="Fleet desk modules"
        >
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'fleet'}
            onClick={() => selectTab('fleet')}
            className={`flex-1 px-2 py-1.5 rounded-md text-[11px] sm:text-xs font-semibold touch-manipulation ${
              tab === 'fleet' ? 'bg-serpico-blue text-white' : 'text-synth-muted active:bg-white/5'
            }`}
          >
            Fleet
          </button>
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
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        {tab === 'investigation' ? <InvestigationHelper /> : <FleetMap />}
      </div>
    </div>
  );
};

export default ChaseHub;
