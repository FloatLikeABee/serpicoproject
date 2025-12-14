import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';

const Leisure: React.FC = () => {
  const { theme } = useTheme();

  const categories = [
    { icon: '🏋️', title: 'Workouts', description: 'Gym recommendations and training programs' },
    { icon: '📚', title: 'Training', description: 'Professional development and courses' },
    { icon: '🏥', title: 'Healthcare', description: 'Health advice for police forces' },
    { icon: '🍺', title: 'Bars & Clubs', description: 'After-hour social spots' },
    { icon: '🎉', title: 'Social Activities', description: 'Community events and gatherings' },
  ];

  return (
    <div className={`h-full flex flex-col ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <div className={`p-4 border-b ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
        <h1 className="text-2xl font-bold text-serpico-red dark:text-serpico-red-light">Leisure</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">AI chat for after-hour activities and wellness</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {categories.map((category, index) => (
            <div
              key={index}
              className={`p-6 rounded-lg ${
                theme === 'dark' ? 'bg-gray-800' : 'bg-white'
              } shadow-sm hover:shadow-md transition-shadow cursor-pointer`}
            >
              <div className="text-4xl mb-3">{category.icon}</div>
              <h3 className="font-semibold text-lg mb-2 dark:text-white">{category.title}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">{category.description}</p>
            </div>
          ))}
        </div>
      </div>

      <div className={`p-4 border-t ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
        <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
          💬 Open AI Chat drawer to get recommendations and information
        </p>
      </div>
    </div>
  );
};

export default Leisure;

