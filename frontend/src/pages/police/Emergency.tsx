import React, { useState } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';

const Emergency: React.FC = () => {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [emergencies] = useState([
    { id: '1', type: 'Armed Robbery', priority: 'High', location: '123 Main St', time: '2 min ago', category: 'Crime' },
    { id: '2', type: 'Domestic Disturbance', priority: 'Medium', location: '456 Oak Ave', time: '5 min ago', category: 'Domestic' },
    { id: '3', type: 'Traffic Accident', priority: 'Low', location: '789 Pine Rd', time: '10 min ago', category: 'Traffic' },
  ]);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'High':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'Medium':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      default:
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    }
  };

  return (
    <div className={`h-full flex flex-col ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <div className={`p-4 border-b ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
        <h1 className="text-2xl font-bold text-serpico-red dark:text-serpico-red-light">Emergency / 911 Dispatch</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          AI-categorized notifications for {user?.rank || 'Officer'}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {emergencies.map((emergency) => (
          <div
            key={emergency.id}
            className={`p-4 rounded-lg border-l-4 ${
              emergency.priority === 'High'
                ? 'border-red-500'
                : emergency.priority === 'Medium'
                ? 'border-yellow-500'
                : 'border-green-500'
            } ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} shadow-sm`}
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-lg dark:text-white">{emergency.type}</h3>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${getPriorityColor(emergency.priority)}`}>
                {emergency.priority}
              </span>
            </div>
            <div className="space-y-1 text-sm">
              <p className="text-gray-600 dark:text-gray-400">
                📍 {emergency.location}
              </p>
              <p className="text-gray-600 dark:text-gray-400">
                🏷️ {emergency.category} • ⏰ {emergency.time}
              </p>
            </div>
            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                💡 AI Suggestion: Based on your rank and location, this case matches your expertise.
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Emergency;

