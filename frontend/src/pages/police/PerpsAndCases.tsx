import React, { useState } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import AIChatDrawer from '../../components/AIChatDrawer';

const PerpsAndCases: React.FC = () => {
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState<'perps' | 'cases'>('perps');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isChatOpen, setIsChatOpen] = useState(false);

  const categories = ['all', 'assault', 'sexual-assault', 'murder', 'robbery', 'unsolved'];

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
    <div className={`h-full flex flex-col ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <div className={`p-4 border-b ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-serpico-red dark:text-serpico-red-light">Perps & Cases</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">AI chat with perp database and case library</p>
          </div>
          <button
            onClick={() => setIsChatOpen(true)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              theme === 'dark'
                ? 'bg-serpico-blue hover:bg-serpico-blue-dark text-white'
                : 'bg-serpico-blue hover:bg-serpico-blue-dark text-white'
            }`}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v12M6 12h12" />
              <circle cx="12" cy="12" r="3" fill="currentColor" />
            </svg>
            <span>AI Chat</span>
          </button>
        </div>
        
        {/* Tab Switcher */}
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => setActiveTab('perps')}
            className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium ${
              activeTab === 'perps'
                ? 'bg-serpico-blue text-white'
                : theme === 'dark'
                ? 'bg-gray-700 text-gray-300'
                : 'bg-gray-200 text-gray-700'
            }`}
          >
            Perps
          </button>
          <button
            onClick={() => setActiveTab('cases')}
            className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium ${
              activeTab === 'cases'
                ? 'bg-serpico-blue text-white'
                : theme === 'dark'
                ? 'bg-gray-700 text-gray-300'
                : 'bg-gray-200 text-gray-700'
            }`}
          >
            Cases
          </button>
        </div>

        {/* Search */}
        <div className="mt-4">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={activeTab === 'perps' ? 'Search perps...' : 'Search cases...'}
            className={`w-full px-4 py-2 rounded-lg border ${
              theme === 'dark'
                ? 'bg-gray-700 border-gray-600 text-white'
                : 'bg-white border-gray-300'
            } focus:outline-none focus:ring-2 focus:ring-serpico-blue`}
          />
        </div>

        {/* Case Categories */}
        {activeTab === 'cases' && (
          <div className="mt-4 flex gap-2 overflow-x-auto">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${
                  selectedCategory === cat
                    ? 'bg-serpico-red text-white'
                    : theme === 'dark'
                    ? 'bg-gray-700 text-gray-300'
                    : 'bg-gray-200 text-gray-700'
                }`}
              >
                {cat.charAt(0).toUpperCase() + cat.slice(1).replace('-', ' ')}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {activeTab === 'perps' ? (
          mockPerps.map((perp) => (
            <div
              key={perp.id}
              className={`p-4 rounded-lg ${
                theme === 'dark' ? 'bg-gray-800' : 'bg-white'
              } shadow-sm`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-lg dark:text-white">{perp.alias}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    📍 {perp.location} • Last seen: {perp.lastSeen} • Cases: {perp.cases}
                  </p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  perp.status === 'Active' || perp.status === 'Wanted'
                    ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                    : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                }`}>
                  {perp.status}
                </span>
              </div>
            </div>
          ))
        ) : (
          mockCases.map((caseItem) => (
            <div
              key={caseItem.id}
              className={`p-4 rounded-lg ${
                theme === 'dark' ? 'bg-gray-800' : 'bg-white'
              } shadow-sm`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-lg dark:text-white">{caseItem.type}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    📅 {caseItem.date} • 📍 {caseItem.location}
                  </p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  caseItem.status === 'Solved'
                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                    : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                }`}>
                  {caseItem.status}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      <div className={`p-4 border-t ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
        <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
          💬 Click the AI Chat button above to query {activeTab === 'perps' ? 'perp' : 'case'} information
        </p>
      </div>

      {/* AI Chat Drawer */}
      <AIChatDrawer 
        isOpen={isChatOpen} 
        onClose={() => setIsChatOpen(false)}
        context="perps-cases"
      />
    </div>
  );
};

export default PerpsAndCases;

