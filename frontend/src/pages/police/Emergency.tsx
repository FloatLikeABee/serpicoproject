import React, { useState } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';

const Emergency: React.FC = () => {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [emergencies] = useState([
    { id: '1', type: 'New Serial Killer Case', priority: 'High', location: 'Portland, Oregon', time: '2 hours ago', category: 'Serial Killer', description: 'Pattern of unsolved murders detected. Possible connection to previous cases.' },
    { id: '2', type: 'Paranormal Activity Report', priority: 'Medium', location: 'Point Pleasant, WV', time: '5 hours ago', category: 'Paranormal', description: 'Multiple Mothman sightings reported. Witnesses describe large winged creature.' },
    { id: '3', type: 'Conspiracy Theory Alert', priority: 'Low', location: 'Nevada', time: '1 day ago', category: 'Conspiracy', description: 'New Area 51 whistleblower testimony. Classified documents may be relevant.' },
    { id: '4', type: 'Urban Legend Activity', priority: 'Medium', location: 'Various locations', time: '2 days ago', category: 'Urban Legend', description: 'Increased reports of vanishing hitchhiker phenomenon across multiple states.' },
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
      <div className={`p-3 sm:p-4 border-b ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
        <h1 className="text-xl sm:text-2xl font-bold text-serpico-red dark:text-serpico-red-light">Alerts & Notifications</h1>
        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1">
          New serial killer cases, paranormal events, urban legends & conspiracy theories
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3">
        {emergencies.map((emergency) => (
          <div
            key={emergency.id}
            className={`p-3 sm:p-4 rounded-lg border-l-4 ${
              emergency.priority === 'High'
                ? 'border-red-500'
                : emergency.priority === 'Medium'
                ? 'border-yellow-500'
                : 'border-green-500'
            } ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} shadow-sm`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
              <h3 className="font-semibold text-base sm:text-lg dark:text-white break-words">{emergency.type}</h3>
              <span className={`px-2 sm:px-3 py-1 rounded-full text-xs font-medium flex-shrink-0 self-start sm:self-auto ${getPriorityColor(emergency.priority)}`}>
                {emergency.priority}
              </span>
            </div>
            <div className="space-y-1 text-sm">
              <p className="text-gray-600 dark:text-gray-400 break-words">
                📍 {emergency.location}
              </p>
              <p className="text-gray-600 dark:text-gray-400">
                🏷️ {emergency.category} • ⏰ {emergency.time}
              </p>
              {(emergency as any).description && (
                <p className="text-gray-700 dark:text-gray-300 mt-2 break-words">
                  {(emergency as any).description}
                </p>
              )}
            </div>
            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                💡 AI Insight: This alert matches your interests and expertise in {emergency.category.toLowerCase()} cases.
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Emergency;

