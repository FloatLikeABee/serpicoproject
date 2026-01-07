import React, { useState } from 'react';
import { useTheme } from '../../contexts/ThemeContext';

interface Notification {
  id: string;
  type: string;
  category: string;
  severity: string;
  location: string;
  time: string;
  description: string;
}

const CrimeNotifications: React.FC = () => {
  const { theme } = useTheme();

  const mockNotifications: Notification[] = [
    { id: '1', type: 'New Serial Case', category: 'Serial Killer', severity: 'High', location: 'Portland, Oregon', time: '2 days ago', description: 'Pattern of unsolved murders detected' },
    { id: '2', type: 'Paranormal Event', category: 'Paranormal', severity: 'Medium', location: 'Point Pleasant, WV', time: '5 days ago', description: 'Mothman sightings reported' },
    { id: '3', type: 'Urban Legend', category: 'Urban Legend', severity: 'Low', location: 'Various locations', time: '1 week ago', description: 'New reports of vanishing hitchhiker' },
    { id: '4', type: 'Conspiracy Theory', category: 'Conspiracy', severity: 'Medium', location: 'Nevada', time: '3 days ago', description: 'Area 51 whistleblower testimony' },
    { id: '5', type: 'New Serial Case', category: 'Serial Killer', severity: 'High', location: 'Phoenix, Arizona', time: '1 week ago', description: 'Multiple bodies found with similar MO' },
    { id: '6', type: 'Paranormal Event', category: 'Paranormal', severity: 'High', location: 'Ballard, Utah', time: '2 weeks ago', description: 'Skinwalker Ranch new documentation' },
  ];

  const getSeverityColor = (severity: string) => {
    switch (severity) {
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
        <h1 className="text-2xl font-bold text-serpico-blue dark:text-serpico-blue-light">Notifications</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">New serial cases, paranormal events, urban legends & conspiracy theories</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {mockNotifications.map((notification) => (
          <div
            key={notification.id}
            className={`p-4 rounded-lg border-l-4 ${
              notification.severity === 'High'
                ? 'border-red-500'
                : notification.severity === 'Medium'
                ? 'border-yellow-500'
                : 'border-green-500'
            } ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} shadow-sm`}
          >
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="font-semibold text-lg dark:text-white">{notification.type}</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">{notification.category}</p>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${getSeverityColor(notification.severity)}`}>
                {notification.severity}
              </span>
            </div>
            <div className="space-y-1 text-sm">
              <p className="text-gray-700 dark:text-gray-300">{notification.description}</p>
              <p className="text-gray-600 dark:text-gray-400">
                📍 {notification.location}
              </p>
              <p className="text-gray-600 dark:text-gray-400">
                ⏰ {notification.time}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CrimeNotifications;

