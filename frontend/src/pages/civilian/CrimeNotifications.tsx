import React, { useState } from 'react';
import { useTheme } from '../../contexts/ThemeContext';

const CrimeNotifications: React.FC = () => {
  const { theme } = useTheme();

  const mockNotifications = [
    { id: '1', type: 'Robbery Alert', severity: 'High', location: '0.3 miles away', time: '5 min ago' },
    { id: '2', type: 'Theft Report', severity: 'Medium', location: '1.0 miles away', time: '15 min ago' },
    { id: '3', type: 'Vandalism', severity: 'Low', location: '2.5 miles away', time: '1 hour ago' },
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
        <h1 className="text-2xl font-bold text-serpico-blue dark:text-serpico-blue-light">Crime Notifications</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">Location-based crime alerts</p>
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
              <h3 className="font-semibold text-lg dark:text-white">{notification.type}</h3>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${getSeverityColor(notification.severity)}`}>
                {notification.severity}
              </span>
            </div>
            <div className="space-y-1 text-sm">
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

