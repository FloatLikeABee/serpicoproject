import React, { useState } from 'react';
import { useTheme } from '../../contexts/ThemeContext';

const SafeRoutes: React.FC = () => {
  const { theme } = useTheme();
  const [destination, setDestination] = useState('');

  const mockRoutes = [
    { id: '1', from: 'Current Location', to: 'Downtown', safety: 'High', time: '15 min', distance: '3.2 miles' },
    { id: '2', from: 'Current Location', to: 'Airport', safety: 'Medium', time: '25 min', distance: '8.5 miles' },
  ];

  const getSafetyColor = (safety: string) => {
    switch (safety) {
      case 'High':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'Medium':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      default:
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
    }
  };

  return (
    <div className={`h-full flex flex-col ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <div className={`p-4 border-b ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
        <h1 className="text-2xl font-bold text-serpico-blue dark:text-serpico-blue-light">Safe Route Recommendations</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">AI-powered route suggestions</p>
        
        <div className="mt-4">
          <input
            type="text"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            placeholder="Enter destination..."
            className={`w-full px-4 py-2 rounded-lg border ${
              theme === 'dark'
                ? 'bg-gray-700 border-gray-600 text-white'
                : 'bg-white border-gray-300'
            } focus:outline-none focus:ring-2 focus:ring-serpico-blue`}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {mockRoutes.map((route) => (
          <div
            key={route.id}
            className={`p-4 rounded-lg ${
              theme === 'dark' ? 'bg-gray-800' : 'bg-white'
            } shadow-sm`}
          >
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="font-semibold text-lg dark:text-white">{route.from} → {route.to}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  ⏱️ {route.time} • 📏 {route.distance}
                </p>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${getSafetyColor(route.safety)}`}>
                {route.safety} Safety
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              ✅ AI recommends this route - avoids known danger zones
            </p>
          </div>
        ))}
      </div>

      <div className={`p-4 border-t ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
        <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
          💬 Open AI Chat drawer for custom route planning
        </p>
      </div>
    </div>
  );
};

export default SafeRoutes;

