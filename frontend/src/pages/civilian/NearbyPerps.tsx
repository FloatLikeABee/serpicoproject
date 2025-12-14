import React, { useState } from 'react';
import { useTheme } from '../../contexts/ThemeContext';

const NearbyPerps: React.FC = () => {
  const { theme } = useTheme();

  const mockEvents = [
    { id: '1', type: 'Armed Robbery', date: '2024-01-10', location: '0.5 miles away', status: 'Resolved' },
    { id: '2', type: 'Assault', date: '2023-12-15', location: '1.2 miles away', status: 'Resolved' },
    { id: '3', type: 'Theft', date: '2023-11-20', location: '0.8 miles away', status: 'Resolved' },
  ];

  return (
    <div className={`h-full flex flex-col ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <div className={`p-4 border-b ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
        <h1 className="text-2xl font-bold text-serpico-blue dark:text-serpico-blue-light">Nearby Perps/Criminals</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">Recent history events (privacy-compliant)</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {mockEvents.map((event) => (
          <div
            key={event.id}
            className={`p-4 rounded-lg ${
              theme === 'dark' ? 'bg-gray-800' : 'bg-white'
            } shadow-sm`}
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-lg dark:text-white">{event.type}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  📍 {event.location} • {event.date}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                  Names and faces are protected for privacy
                </p>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                {event.status}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className={`p-4 border-t ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
        <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
          💬 Open AI Chat drawer for more information about recent events
        </p>
      </div>
    </div>
  );
};

export default NearbyPerps;

