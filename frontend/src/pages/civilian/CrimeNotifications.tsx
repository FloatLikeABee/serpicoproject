import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../contexts/ThemeContext';

const CrimeNotifications: React.FC = () => {
  const { theme } = useTheme();
  const navigate = useNavigate();

  const handleAIChatClick = () => {
    navigate('/ai-chat');
  };

  return (
    <div className={`h-full flex flex-col items-center justify-center p-4 ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <div className={`w-full max-w-md p-6 sm:p-8 rounded-lg ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} shadow-lg`}>
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-serpico-blue bg-opacity-10 mb-4">
            <svg
              width="40"
              height="40"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-serpico-blue"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v12M6 12h12" />
              <circle cx="12" cy="12" r="3" fill="currentColor" />
            </svg>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-serpico-blue dark:text-serpico-blue-light mb-2">
            AI Chat
          </h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
            Get instant answers about serial killers, mysteries, and case information
          </p>
        </div>

        <button
          onClick={handleAIChatClick}
          className={`w-full py-4 px-6 rounded-lg font-semibold text-lg transition-all transform active:scale-95 touch-manipulation ${
            theme === 'dark'
              ? 'bg-serpico-blue hover:bg-serpico-blue-dark text-white'
              : 'bg-serpico-blue hover:bg-serpico-blue-dark text-white'
          } shadow-lg`}
        >
          Open AI Chat
        </button>

        <div className="mt-6 space-y-3 text-sm text-gray-600 dark:text-gray-400">
          <div className="flex items-start gap-3">
            <span className="text-xl">🔍</span>
            <div>
              <p className="font-medium dark:text-gray-300">Search Cases</p>
              <p className="text-xs">Ask about serial killers and their cases</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-xl">👻</span>
            <div>
              <p className="font-medium dark:text-gray-300">Explore Mysteries</p>
              <p className="text-xs">Learn about paranormal events and urban legends</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-xl">📚</span>
            <div>
              <p className="font-medium dark:text-gray-300">Study Guides</p>
              <p className="text-xs">Access forensic studies and profiling techniques</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CrimeNotifications;

