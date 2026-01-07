import React, { useState } from 'react';
import { useTheme } from '../../contexts/ThemeContext';

type MysteryCategory = 'all' | 'paranormal' | 'urban-legend' | 'conspiracy';

const Mysteries: React.FC = () => {
  const { theme } = useTheme();
  const [selectedCategory, setSelectedCategory] = useState<MysteryCategory>('all');

  const categories = [
    { id: 'all' as MysteryCategory, icon: '🔍', title: 'All Mysteries', description: 'Browse all unexplained phenomena' },
    { id: 'paranormal' as MysteryCategory, icon: '👻', title: 'Paranormal', description: 'Ghosts, spirits, and supernatural events' },
    { id: 'urban-legend' as MysteryCategory, icon: '📖', title: 'Urban Legends', description: 'Famous stories and folklore' },
    { id: 'conspiracy' as MysteryCategory, icon: '🕵️', title: 'Conspiracy Theories', description: 'Hidden truths and cover-ups' },
  ];

  // Mock mysteries data - will be replaced with API calls
  const mockMysteries = [
    {
      id: '1',
      title: 'The Mothman Sightings',
      category: 'paranormal',
      location: 'Point Pleasant, West Virginia',
      date: '2024-01-15',
      description: 'Multiple eyewitness reports of a large winged creature with glowing red eyes. First reported in 1966, sightings continue to this day.',
      credibility: 'High',
    },
    {
      id: '2',
      title: 'The Philadelphia Experiment',
      category: 'conspiracy',
      location: 'Philadelphia, Pennsylvania',
      date: '2024-01-10',
      description: 'Alleged military experiment in 1943 that made a destroyer invisible. Classified documents suggest possible truth.',
      credibility: 'Medium',
    },
    {
      id: '3',
      title: 'The Vanishing Hitchhiker',
      category: 'urban-legend',
      location: 'Various locations, North America',
      date: '2024-01-08',
      description: 'Classic urban legend of a hitchhiker who disappears from moving vehicles. Reported across multiple states.',
      credibility: 'Low',
    },
    {
      id: '4',
      title: 'Skinwalker Ranch',
      category: 'paranormal',
      location: 'Ballard, Utah',
      date: '2024-01-05',
      description: 'Ranch with documented UFO sightings, strange creatures, and unexplained phenomena. Ongoing scientific investigation.',
      credibility: 'High',
    },
    {
      id: '5',
      title: 'Area 51 Secrets',
      category: 'conspiracy',
      location: 'Groom Lake, Nevada',
      date: '2024-01-03',
      description: 'Alleged reverse engineering of alien technology. Multiple whistleblower testimonies suggest hidden programs.',
      credibility: 'Medium',
    },
    {
      id: '6',
      title: 'The Bell Witch',
      category: 'paranormal',
      location: 'Adams, Tennessee',
      date: '2023-12-28',
      description: 'One of America\'s most documented poltergeist cases. Haunting of the Bell family in the early 1800s.',
      credibility: 'High',
    },
  ];

  const filteredMysteries = selectedCategory === 'all' 
    ? mockMysteries 
    : mockMysteries.filter(m => m.category === selectedCategory);

  const getCredibilityColor = (credibility: string) => {
    switch (credibility) {
      case 'High':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'Medium':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'paranormal':
        return '👻';
      case 'urban-legend':
        return '📖';
      case 'conspiracy':
        return '🕵️';
      default:
        return '🔍';
    }
  };

  return (
    <div className={`h-full flex flex-col ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <div className={`p-4 border-b ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
        <h1 className="text-2xl font-bold text-serpico-red dark:text-serpico-red-light">Mysteries</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">Unexplained phenomena, urban legends & conspiracy theories</p>
      </div>

      {/* Category Filter */}
      <div className={`p-4 border-b ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => setSelectedCategory(category.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
                selectedCategory === category.id
                  ? 'bg-serpico-red text-white'
                  : theme === 'dark'
                  ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <span className="text-xl">{category.icon}</span>
              <span className="font-medium">{category.title}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Mysteries List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {filteredMysteries.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            No mysteries found in this category
          </div>
        ) : (
          filteredMysteries.map((mystery) => (
            <div
              key={mystery.id}
              className={`p-5 rounded-lg border-l-4 ${
                mystery.category === 'paranormal'
                  ? 'border-purple-500'
                  : mystery.category === 'urban-legend'
                  ? 'border-blue-500'
                  : 'border-orange-500'
              } ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} shadow-sm hover:shadow-md transition-shadow`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{getCategoryIcon(mystery.category)}</span>
                  <div>
                    <h3 className="font-bold text-lg dark:text-white">{mystery.title}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      📍 {mystery.location} • 📅 {mystery.date}
                    </p>
                  </div>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${getCredibilityColor(mystery.credibility)}`}>
                  {mystery.credibility}
                </span>
              </div>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">{mystery.description}</p>
            </div>
          ))
        )}
      </div>

      <div className={`p-4 border-t ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
        <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
          💬 Open AI Chat to explore mysteries and get detailed information
        </p>
      </div>
    </div>
  );
};

export default Mysteries;

