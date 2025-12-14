import React, { useState } from 'react';
import { useTheme } from '../../contexts/ThemeContext';

const Perps: React.FC = () => {
  const { theme } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');

  const mockPerps = [
    { id: '1', alias: 'Subject A', lastSeen: '2024-01-15', cases: 3, status: 'Active' },
    { id: '2', alias: 'Subject B', lastSeen: '2024-01-10', cases: 1, status: 'Wanted' },
    { id: '3', alias: 'Subject C', lastSeen: '2023-12-20', cases: 5, status: 'In Custody' },
  ];

  return (
    <div className={`h-full flex flex-col ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <div className={`p-4 border-b ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
        <h1 className="text-2xl font-bold text-serpico-red dark:text-serpico-red-light">Perps</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">AI chat with perp database (last 3 years)</p>
        
        <div className="mt-4">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search perps..."
            className={`w-full px-4 py-2 rounded-lg border ${
              theme === 'dark'
                ? 'bg-gray-700 border-gray-600 text-white'
                : 'bg-white border-gray-300'
            } focus:outline-none focus:ring-2 focus:ring-serpico-blue`}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {mockPerps.map((perp) => (
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
                  Last seen: {perp.lastSeen} • Cases: {perp.cases}
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
        ))}
      </div>

      <div className={`p-4 border-t ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
        <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
          💬 Open AI Chat drawer to query perp information
        </p>
      </div>
    </div>
  );
};

export default Perps;

