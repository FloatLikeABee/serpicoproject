import React, { useState } from 'react';

const PerpsAndCases: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'perps' | 'cases'>('perps');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const categories = ['all', 'assault', 'sexual-assault', 'murder', 'robbery', 'unsolved'];

  const getCategoryLabel = (cat: string, isMobile = false) => {
    if (isMobile) {
      const mobileLabels: Record<string, string> = {
        all: 'All',
        assault: 'Assault',
        'sexual-assault': 'Sexual',
        murder: 'Murder',
        robbery: 'Robbery',
        unsolved: 'Unsolved',
      };
      return mobileLabels[cat] || cat;
    }
    return cat.charAt(0).toUpperCase() + cat.slice(1).replace('-', ' ');
  };

  const mockPerps = [
    { id: '1', alias: 'Subject Alpha', lastSeen: '2024-01-15', location: 'Downtown Olathe', cases: 3, status: 'Active' },
    { id: '2', alias: 'Subject Bravo', lastSeen: '2024-01-10', location: 'North Olathe', cases: 1, status: 'Wanted' },
    { id: '3', alias: 'Subject Charlie', lastSeen: '2023-12-20', location: 'East Olathe', cases: 5, status: 'In Custody' },
    { id: '4', alias: 'Subject Delta', lastSeen: '2024-01-05', location: 'South Olathe', cases: 2, status: 'Active' },
  ];

  const mockCases = [
    { id: '1', type: 'Armed Assault', date: '2023-11-15', location: '123 S Kansas Ave, Olathe', status: 'Solved' },
    { id: '2', type: 'Robbery', date: '2023-10-20', location: '456 E Santa Fe St, Olathe', status: 'Solved' },
    { id: '3', type: 'Murder', date: '2023-09-05', location: '789 N Ridgeview Rd, Olathe', status: 'Unsolved' },
    { id: '4', type: 'Sexual Assault', date: '2023-08-12', location: '321 W Park St, Olathe', status: 'Solved' },
  ];

  return (
    <div className="page-fill">
      <div className="game-header p-2 sm:p-4 flex-shrink-0">
        <h1 className="text-lg sm:text-xl font-display font-bold neon-text-magenta tracking-wide">Records</h1>
        <p className="text-[10px] sm:text-xs text-synth-muted mt-0.5 font-mono uppercase tracking-wider">
          Serial killer database & case files
        </p>

        {/* Neon tab switcher */}
        <div className="neon-tab-bar mt-3">
          <button
            type="button"
            onClick={() => setActiveTab('perps')}
            className={`neon-tab ${activeTab === 'perps' ? 'neon-tab-active-cyan' : ''}`}
          >
            <span aria-hidden>🔪</span>
            <span>Killers</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('cases')}
            className={`neon-tab ${activeTab === 'cases' ? 'neon-tab-active-magenta' : ''}`}
          >
            <span aria-hidden>📁</span>
            <span>Cases</span>
          </button>
        </div>

        <div className="mt-3">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={activeTab === 'perps' ? 'Search serial killers...' : 'Search cases...'}
            className="synth-input py-2 text-sm"
          />
        </div>

        {activeTab === 'cases' && (
          <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-2.5 py-1 rounded-md text-[10px] sm:text-xs font-display font-semibold uppercase tracking-wide whitespace-nowrap flex-shrink-0 transition-all ${
                  selectedCategory === cat
                    ? 'neon-tab-active-magenta'
                    : 'text-synth-muted border border-neon-purple/30 bg-synth-deep/60'
                }`}
              >
                {getCategoryLabel(cat, true)}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="scroll-area p-2 sm:p-4 space-y-2 sm:space-y-3">
        {activeTab === 'perps'
          ? mockPerps.map((perp) => (
              <div key={perp.id} className="game-panel p-3 sm:p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-display font-semibold text-sm sm:text-base dark:text-white truncate">{perp.alias}</h3>
                    <p className="text-[10px] sm:text-xs text-synth-muted mt-1 break-words">
                      {perp.location} · {perp.lastSeen} · {perp.cases} cases
                    </p>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-display font-semibold uppercase flex-shrink-0 ${
                      perp.status === 'Active' || perp.status === 'Wanted'
                        ? 'bg-neon-magenta/20 text-neon-magenta border border-neon-magenta/40'
                        : 'bg-neon-green/15 text-neon-green border border-neon-green/30'
                    }`}
                  >
                    {perp.status}
                  </span>
                </div>
              </div>
            ))
          : mockCases.map((caseItem) => (
              <div key={caseItem.id} className="game-panel p-3 sm:p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-display font-semibold text-sm sm:text-base dark:text-white break-words">{caseItem.type}</h3>
                    <p className="text-[10px] sm:text-xs text-synth-muted mt-1 break-words">
                      {caseItem.date} · {caseItem.location}
                    </p>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-display font-semibold uppercase flex-shrink-0 ${
                      caseItem.status === 'Solved'
                        ? 'bg-neon-green/15 text-neon-green border border-neon-green/30'
                        : 'bg-neon-amber/15 text-neon-amber border border-neon-amber/40'
                    }`}
                  >
                    {caseItem.status}
                  </span>
                </div>
              </div>
            ))}
      </div>
    </div>
  );
};

export default PerpsAndCases;
