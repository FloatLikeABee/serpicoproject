import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { chatAPI } from '../services/api';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface AIChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  context?: string;
}

const AIChatDrawer: React.FC<AIChatDrawerProps> = ({ isOpen, onClose, context }) => {
  const getInitialMessage = () => {
    const contextMessages: Record<string, string> = {
      'in-pursue': 'Hello! I\'m your Serpico AI assistant for Olathe PD. I can help you with active pursuits, suspect locations, and pursuit strategies. How can I assist you?',
      'perps-cases': 'Hello! I can help you search for information about known perpetrators and case history in Olathe. What would you like to know?',
      'perps': 'Hello! I can help you search for information about known perpetrators in Olathe. What would you like to know?',
      'case-library': 'Hello! I can help you search through Olathe PD case history. What case information are you looking for?',
      'emergency': 'Hello! I can help you with emergency dispatch information and recommendations. How can I assist?',
      'leisure': 'Hello! I can help you with after-hour activities, training, and wellness information for Olathe PD officers. What do you need?',
      'nearby-officers': 'Hello! I can help you find information about nearby Olathe PD officers and their locations. How can I help?',
      'nearby-perps': 'Hello! I can provide information about recent criminal activity in Olathe. What would you like to know?',
      'safe-routes': 'Hello! I can help you find safe routes in Olathe based on recent crime data. Where would you like to go?',
      'crime-notifications': 'Hello! I can help you understand recent crime notifications in Olathe. What information do you need?',
    };
    return contextMessages[context || ''] || 'Hello! I\'m your Serpico AI assistant for Olathe PD. How can I help you today?';
  };

  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: getInitialMessage(),
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();
  const { theme } = useTheme();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  // Update initial message when context changes (only if it's still the initial message)
  useEffect(() => {
    setMessages([{
      id: '1',
      role: 'assistant',
      content: getInitialMessage(),
      timestamp: new Date(),
    }]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    const messageText = input;
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Call backend AI API
      const response = await chatAPI.sendMessage(messageText, context);
      
      const aiMessage: Message = {
        id: response.response.id || (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.response.content,
        timestamp: new Date(response.response.timestamp || new Date()),
      };
      
      setMessages(prev => [...prev, aiMessage]);
    } catch (error: any) {
      console.error('AI chat error:', error);
      
      // Show error message to user
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: error.response?.data?.error 
          ? `Error: ${error.response.data.error}` 
          : 'Sorry, I encountered an error processing your request. Please try again.',
        timestamp: new Date(),
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={onClose}
        />
      )}

      {/* Drawer */}
      <div
        className={`fixed right-0 top-0 h-full w-full sm:w-96 ${
          theme === 'dark' ? 'bg-gray-800' : 'bg-white'
        } shadow-xl z-50 transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className={`flex items-center justify-between p-4 border-b ${
          theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
        }`}>
          <h2 className="text-xl font-bold text-serpico-blue dark:text-serpico-blue-light">
            AI Assistant
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4" style={{ height: 'calc(100% - 140px)' }}>
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-lg p-3 ${
                  message.role === 'user'
                    ? 'bg-serpico-blue text-white'
                    : theme === 'dark'
                    ? 'bg-gray-700 text-gray-100'
                    : 'bg-gray-100 text-gray-900'
                }`}
              >
                {message.role === 'assistant' ? (
                  <div className="text-sm prose prose-sm dark:prose-invert max-w-none">
                    <ReactMarkdown
                      components={{
                        p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                        ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
                        ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
                        li: ({ children }) => <li className="ml-2">{children}</li>,
                        h1: ({ children }) => <h1 className="text-lg font-bold mb-2">{children}</h1>,
                        h2: ({ children }) => <h2 className="text-base font-bold mb-2">{children}</h2>,
                        h3: ({ children }) => <h3 className="text-sm font-bold mb-1">{children}</h3>,
                        code: ({ children, className }) => {
                          const isInline = !className;
                          return isInline ? (
                            <code className="bg-gray-800 dark:bg-gray-900 px-1 py-0.5 rounded text-xs">{children}</code>
                          ) : (
                            <code className="block bg-gray-800 dark:bg-gray-900 p-2 rounded text-xs overflow-x-auto">{children}</code>
                          );
                        },
                        pre: ({ children }) => <pre className="bg-gray-800 dark:bg-gray-900 p-2 rounded mb-2 overflow-x-auto">{children}</pre>,
                        strong: ({ children }) => <strong className="font-bold">{children}</strong>,
                        em: ({ children }) => <em className="italic">{children}</em>,
                        blockquote: ({ children }) => <blockquote className="border-l-4 border-gray-400 pl-2 italic mb-2">{children}</blockquote>,
                      }}
                    >
                      {message.content}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <p className="text-sm">{message.content}</p>
                )}
                <p className={`text-xs mt-1 ${
                  message.role === 'user' ? 'text-blue-100' : 'text-gray-500'
                }`}>
                  {message.timestamp.toLocaleTimeString()}
                </p>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className={`rounded-lg p-3 ${
                theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
              }`}>
                <div className="flex space-x-2">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className={`p-4 border-t ${
          theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
        }`}>
          <div className="flex space-x-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Type your message..."
              className={`flex-1 px-4 py-2 rounded-lg border ${
                theme === 'dark'
                  ? 'bg-gray-700 border-gray-600 text-white'
                  : 'bg-white border-gray-300'
              } focus:outline-none focus:ring-2 focus:ring-serpico-blue`}
            />
            <button
              onClick={handleSend}
              disabled={isLoading || !input.trim()}
              className="bg-serpico-blue text-white px-4 py-2 rounded-lg hover:bg-serpico-blue-dark disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default AIChatDrawer;

