import React, { useState } from 'react';
import { useTheme } from '../../contexts/ThemeContext';

type MysteryCategory = 'all' | 'paranormal' | 'urban-legend' | 'conspiracy' | 'studies';
type StudyType = 'forensic' | 'case-studies' | 'profiling';

const Mysteries: React.FC = () => {
  const { theme } = useTheme();
  const [selectedCategory, setSelectedCategory] = useState<MysteryCategory>('all');
  const [selectedStudyType, setSelectedStudyType] = useState<StudyType>('forensic');

  const categories = [
    { id: 'all' as MysteryCategory, icon: '🔍', title: 'All Mysteries', description: 'Browse all unexplained phenomena' },
    { id: 'paranormal' as MysteryCategory, icon: '👻', title: 'Paranormal', description: 'Ghosts, spirits, and supernatural events' },
    { id: 'urban-legend' as MysteryCategory, icon: '📖', title: 'Urban Legends', description: 'Famous stories and folklore' },
    { id: 'conspiracy' as MysteryCategory, icon: '🕵️', title: 'Conspiracy Theories', description: 'Hidden truths and cover-ups' },
    { id: 'studies' as MysteryCategory, icon: '📚', title: 'Studies', description: 'Forensic studies, case studies & profiling' },
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

  // Mock studies data
  const mockForensicStudies = [
    {
      id: 'fs1',
      title: 'DNA Analysis in Cold Cases',
      type: 'forensic',
      date: '2024-01-20',
      description: 'How modern DNA techniques solved the 30-year-old Zodiac Killer case. Learn about genetic genealogy and familial DNA matching.',
      difficulty: 'Advanced',
      duration: '45 min read',
    },
    {
      id: 'fs2',
      title: 'Fingerprint Evolution',
      type: 'forensic',
      date: '2024-01-18',
      description: 'From ink to digital: The fascinating history of fingerprinting and its role in catching serial killers like Ted Bundy.',
      difficulty: 'Intermediate',
      duration: '30 min read',
    },
    {
      id: 'fs3',
      title: 'Ballistics & Weapon Matching',
      type: 'forensic',
      date: '2024-01-15',
      description: 'How ballistics experts linked multiple murders to the same weapon. Real techniques used in the BTK case.',
      difficulty: 'Advanced',
      duration: '50 min read',
    },
    {
      id: 'fs4',
      title: 'Toxicology in Serial Killings',
      type: 'forensic',
      date: '2024-01-12',
      description: 'Detecting poisons and drugs in victims. How forensic toxicology helped solve the Harold Shipman case.',
      difficulty: 'Intermediate',
      duration: '35 min read',
    },
  ];

  const mockCaseStudies = [
    {
      id: 'cs1',
      title: 'The BTK Investigation',
      type: 'case-studies',
      date: '2024-01-22',
      description: 'Deep dive into how Dennis Rader was caught after 30 years. Analysis of communication patterns, DNA evidence, and digital forensics.',
      cases: '10 murders',
      status: 'Solved',
    },
    {
      id: 'cs2',
      title: 'The Green River Killer',
      type: 'case-studies',
      date: '2024-01-19',
      description: 'How Gary Ridgway evaded capture for 20 years. Study of victimology, geographic profiling, and the breakthrough DNA match.',
      cases: '49+ murders',
      status: 'Solved',
    },
    {
      id: 'cs3',
      title: 'The Golden State Killer',
      type: 'case-studies',
      date: '2024-01-16',
      description: 'The first major case solved using genetic genealogy. Joseph DeAngelo\'s capture through familial DNA databases.',
      cases: '13 murders, 50+ rapes',
      status: 'Solved',
    },
    {
      id: 'cs4',
      title: 'The Zodiac Killer',
      type: 'case-studies',
      date: '2024-01-13',
      description: 'The unsolved mystery that haunted California. Cryptography, handwriting analysis, and the letters that taunted police.',
      cases: '5 confirmed, 37 claimed',
      status: 'Unsolved',
    },
  ];

  const mockProfiling = [
    {
      id: 'cp1',
      title: 'Behavioral Analysis of Serial Killers',
      type: 'profiling',
      date: '2024-01-21',
      description: 'Understanding the psychology behind serial killers. Organized vs disorganized offenders, signature vs modus operandi.',
      profileType: 'Psychological',
      examples: 'Bundy, Dahmer, Gacy',
    },
    {
      id: 'cp2',
      title: 'Geographic Profiling Techniques',
      type: 'profiling',
      date: '2024-01-17',
      description: 'How location data helps catch serial killers. The "circle theory" and how killers operate in comfort zones.',
      profileType: 'Geographic',
      examples: 'Ridgway, BTK, Green River',
    },
    {
      id: 'cp3',
      title: 'Victimology & Target Selection',
      type: 'profiling',
      date: '2024-01-14',
      description: 'Why serial killers choose specific victims. Patterns in age, appearance, lifestyle, and vulnerability factors.',
      profileType: 'Victimology',
      examples: 'Multiple case studies',
    },
    {
      id: 'cp4',
      title: 'Digital Age Profiling',
      type: 'profiling',
      date: '2024-01-11',
      description: 'Modern profiling using social media, digital footprints, and online behavior. How the internet changed criminal investigation.',
      profileType: 'Digital',
      examples: 'Recent cases',
    },
  ];

  const filteredMysteries = selectedCategory === 'all' 
    ? mockMysteries 
    : selectedCategory === 'studies'
    ? []
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
      <div className={`p-3 sm:p-4 border-b ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
        <h1 className="text-xl sm:text-2xl font-bold text-serpico-red dark:text-serpico-red-light">Mysteries</h1>
        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1">Unexplained phenomena, urban legends & conspiracy theories</p>
      </div>

      {/* Category Filter */}
      <div className={`p-2 sm:p-4 border-b ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
        <div className="flex gap-1.5 sm:gap-2 overflow-x-auto pb-2 -mx-2 sm:mx-0 px-2 sm:px-0 scrollbar-hide">
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => setSelectedCategory(category.id)}
              className={`flex items-center justify-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 rounded-lg whitespace-nowrap transition-colors touch-manipulation flex-shrink-0 ${
                selectedCategory === category.id
                  ? 'bg-serpico-red text-white'
                  : theme === 'dark'
                  ? 'bg-gray-700 text-gray-300 active:bg-gray-600'
                  : 'bg-gray-100 text-gray-700 active:bg-gray-200'
              }`}
              title={category.title}
            >
              <span className="text-xl sm:text-xl">{category.icon}</span>
              <span className="font-medium text-xs sm:text-sm hidden sm:inline">{category.title}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Studies Mini Tabs */}
      {selectedCategory === 'studies' && (
        <div className={`p-2 sm:p-4 border-b ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className="flex gap-1.5 sm:gap-2 overflow-x-auto pb-2 scrollbar-hide">
            <button
              onClick={() => setSelectedStudyType('forensic')}
              className={`flex items-center justify-center px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap touch-manipulation flex-shrink-0 ${
                selectedStudyType === 'forensic'
                  ? 'bg-serpico-blue text-white'
                  : theme === 'dark'
                  ? 'bg-gray-700 text-gray-300 active:bg-gray-600'
                  : 'bg-gray-100 text-gray-700 active:bg-gray-200'
              }`}
              title="Forensic Studies"
            >
              <span className="text-lg sm:text-lg">🔬</span>
              <span className="hidden sm:inline ml-1.5">Forensic</span>
            </button>
            <button
              onClick={() => setSelectedStudyType('case-studies')}
              className={`flex items-center justify-center px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap touch-manipulation flex-shrink-0 ${
                selectedStudyType === 'case-studies'
                  ? 'bg-serpico-blue text-white'
                  : theme === 'dark'
                  ? 'bg-gray-700 text-gray-300 active:bg-gray-600'
                  : 'bg-gray-100 text-gray-700 active:bg-gray-200'
              }`}
              title="Case Studies"
            >
              <span className="text-lg sm:text-lg">📋</span>
              <span className="hidden sm:inline ml-1.5">Case Studies</span>
            </button>
            <button
              onClick={() => setSelectedStudyType('profiling')}
              className={`flex items-center justify-center px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap touch-manipulation flex-shrink-0 ${
                selectedStudyType === 'profiling'
                  ? 'bg-serpico-blue text-white'
                  : theme === 'dark'
                  ? 'bg-gray-700 text-gray-300 active:bg-gray-600'
                  : 'bg-gray-100 text-gray-700 active:bg-gray-200'
              }`}
              title="Criminal Profiling"
            >
              <span className="text-lg sm:text-lg">🧠</span>
              <span className="hidden sm:inline ml-1.5">Profiling</span>
            </button>
          </div>
        </div>
      )}

      {/* Content List */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4">
        {selectedCategory === 'studies' ? (
          // Studies content
          (() => {
            const studies = selectedStudyType === 'forensic' 
              ? mockForensicStudies 
              : selectedStudyType === 'case-studies'
              ? mockCaseStudies
              : mockProfiling;
            
            return studies.length === 0 ? (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                No studies found
              </div>
            ) : (
              studies.map((study) => (
                <div
                  key={study.id}
                  className={`p-4 sm:p-5 rounded-lg border-l-4 border-blue-500 ${
                    theme === 'dark' ? 'bg-gray-800' : 'bg-white'
                  } shadow-sm hover:shadow-md transition-shadow`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-0 mb-3">
                    <div className="flex items-start gap-2 sm:gap-3 flex-1 min-w-0">
                      <span className="text-2xl sm:text-3xl flex-shrink-0">
                        {selectedStudyType === 'forensic' ? '🔬' : selectedStudyType === 'case-studies' ? '📋' : '🧠'}
                      </span>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-bold text-base sm:text-lg dark:text-white break-words">{study.title}</h3>
                        <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1 break-words">
                          📅 {study.date}
                          {selectedStudyType === 'forensic' && ' • ' + (study as any).duration}
                          {selectedStudyType === 'case-studies' && ' • ' + (study as any).cases}
                          {selectedStudyType === 'profiling' && ' • ' + (study as any).profileType}
                        </p>
                      </div>
                    </div>
                    {selectedStudyType === 'forensic' && (
                      <span className={`px-2 sm:px-3 py-1 rounded-full text-xs font-medium flex-shrink-0 self-start sm:self-auto ${
                        (study as any).difficulty === 'Advanced'
                          ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
                          : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                      }`}>
                        {(study as any).difficulty}
                      </span>
                    )}
                    {selectedStudyType === 'case-studies' && (
                      <span className={`px-2 sm:px-3 py-1 rounded-full text-xs font-medium flex-shrink-0 self-start sm:self-auto ${
                        (study as any).status === 'Solved'
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                          : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                      }`}>
                        {(study as any).status}
                      </span>
                    )}
                    {selectedStudyType === 'profiling' && (
                      <span className="px-2 sm:px-3 py-1 rounded-full text-xs font-medium flex-shrink-0 self-start sm:self-auto bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200">
                        {(study as any).profileType}
                      </span>
                    )}
                  </div>
                  <p className="text-sm sm:text-base text-gray-700 dark:text-gray-300 leading-relaxed break-words mb-2">
                    {study.description}
                  </p>
                  {selectedStudyType === 'profiling' && (
                    <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 italic">
                      Examples: {(study as any).examples}
                    </p>
                  )}
                </div>
              ))
            );
          })()
        ) : filteredMysteries.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            No mysteries found in this category
          </div>
        ) : (
          filteredMysteries.map((mystery) => (
            <div
              key={mystery.id}
              className={`p-4 sm:p-5 rounded-lg border-l-4 ${
                mystery.category === 'paranormal'
                  ? 'border-purple-500'
                  : mystery.category === 'urban-legend'
                  ? 'border-blue-500'
                  : 'border-orange-500'
              } ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} shadow-sm hover:shadow-md transition-shadow`}
            >
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-0 mb-3">
                <div className="flex items-start gap-2 sm:gap-3 flex-1 min-w-0">
                  <span className="text-2xl sm:text-3xl flex-shrink-0">{getCategoryIcon(mystery.category)}</span>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-base sm:text-lg dark:text-white break-words">{mystery.title}</h3>
                    <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1 break-words">
                      📍 {mystery.location} • 📅 {mystery.date}
                    </p>
                  </div>
                </div>
                <span className={`px-2 sm:px-3 py-1 rounded-full text-xs font-medium flex-shrink-0 self-start sm:self-auto ${getCredibilityColor(mystery.credibility)}`}>
                  {mystery.credibility}
                </span>
              </div>
              <p className="text-sm sm:text-base text-gray-700 dark:text-gray-300 leading-relaxed break-words">{mystery.description}</p>
            </div>
          ))
        )}
      </div>

      <div className={`p-3 sm:p-4 border-t ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
        <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 text-center">
          💬 Open AI Chat to explore mysteries and get detailed information
        </p>
      </div>
    </div>
  );
};

export default Mysteries;

