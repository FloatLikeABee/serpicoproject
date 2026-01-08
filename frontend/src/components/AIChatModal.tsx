import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';

interface AIChatModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AIChatModal: React.FC<AIChatModalProps> = ({ isOpen, onClose }) => {
  const { theme } = useTheme();
  const navigate = useNavigate();

  const handleAIChatClick = () => {
    onClose();
    navigate('/ai-chat');
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black bg-opacity-30 z-[100]"
        onClick={onClose}
      />

      {/* Modal - Halfway down from top */}
      <div
        className={`fixed left-0 right-0 top-1/2 bottom-0 ${
          theme === 'dark' ? 'bg-gray-800' : 'bg-white'
        } rounded-t-2xl shadow-2xl z-[101] transform transition-transform duration-300 ease-out`}
        style={{ maxHeight: '50vh' }}
      >
        <div className="h-full flex flex-col p-4 sm:p-5">
          {/* Header with close button */}
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-serpico-blue bg-opacity-10 flex items-center justify-center">
                <svg
                  width="18"
                  height="18"
                  className="sm:w-5 sm:h-5 text-serpico-blue"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <h2 className="text-base sm:text-lg font-semibold text-serpico-blue dark:text-serpico-blue-light">
                AI Chat
              </h2>
            </div>
            <button
              onClick={onClose}
              className={`p-1.5 rounded-lg ${
                theme === 'dark'
                  ? 'hover:bg-gray-700 text-gray-400'
                  : 'hover:bg-gray-100 text-gray-500'
              } transition-colors touch-manipulation`}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-4">
              Get instant answers about serial killers, mysteries, and case information
            </p>

            <button
              onClick={handleAIChatClick}
              className={`w-full py-2.5 sm:py-3 px-4 rounded-lg font-medium text-sm sm:text-base transition-all transform active:scale-95 touch-manipulation ${
                theme === 'dark'
                  ? 'bg-serpico-blue active:bg-serpico-blue-dark text-white'
                  : 'bg-serpico-blue active:bg-serpico-blue-dark text-white'
              } shadow-md mb-4`}
            >
              Open AI Chat
            </button>

            <div className="space-y-2.5 sm:space-y-3">
              <div className="flex items-start gap-2">
                <span className="text-base sm:text-lg">🔍</span>
                <div>
                  <p className="text-xs sm:text-sm font-medium dark:text-gray-300">Search Cases</p>
                  <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">Ask about serial killers and their cases</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-base sm:text-lg">👻</span>
                <div>
                  <p className="text-xs sm:text-sm font-medium dark:text-gray-300">Explore Mysteries</p>
                  <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">Learn about paranormal events and urban legends</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-base sm:text-lg">📚</span>
                <div>
                  <p className="text-xs sm:text-sm font-medium dark:text-gray-300">Study Guides</p>
                  <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">Access forensic studies and profiling techniques</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default AIChatModal;
