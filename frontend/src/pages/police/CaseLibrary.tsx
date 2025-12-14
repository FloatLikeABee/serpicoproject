import React, { useState } from 'react';
import { useTheme } from '../../contexts/ThemeContext';

const CaseLibrary: React.FC = () => {
  const { theme } = useTheme();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const categories = ['all', 'assault', 'sexual-assault', 'murder', 'robbery', 'unsolved'];

  const mockCases = [
    { id: '1', type: 'Armed Assault', date: '2023-11-15', location: 'Downtown', status: 'Solved' },
    { id: '2', type: 'Robbery', date: '2023-10-20', location: 'North District', status: 'Solved' },
    { id: '3', type: 'Murder', date: '2023-09-05', location: 'East Side', status: 'Unsolved' },
    { id: '4', type: 'Sexual Assault', date: '2023-08-12', location: 'South Park', status: 'Solved' },
  ];

  return (
    <div className={`h-full flex flex-col ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <div className={`p-4 border-b ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
        <h1 className="text-2xl font-bold text-serpico-red dark:text-serpico-red-light">Case Library</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">Historical cases with AI search and wiki</p>
        
        <div className="mt-4 flex gap-2 overflow-x-auto">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${
                selectedCategory === cat
                  ? 'bg-serpico-blue text-white'
                  : theme === 'dark'
                  ? 'bg-gray-700 text-gray-300'
                  : 'bg-gray-200 text-gray-700'
              }`}
            >
              {cat.charAt(0).toUpperCase() + cat.slice(1).replace('-', ' ')}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {mockCases.map((caseItem) => (
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
                  {caseItem.date} • {caseItem.location}
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
        ))}
      </div>

      <div className={`p-4 border-t ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
        <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
          💬 Open AI Chat drawer to search and query case information
        </p>
      </div>
    </div>
  );
};

export default CaseLibrary;

