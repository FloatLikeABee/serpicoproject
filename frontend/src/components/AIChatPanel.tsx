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

interface AIChatPanelProps {
  context?: string;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

const AIChatPanel: React.FC<AIChatPanelProps> = ({ 
  context, 
  isCollapsed = false,
  onToggleCollapse 
}) => {
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
  const [isMinimized, setIsMinimized] = useState(isCollapsed);

  useEffect(() => {
    if (!isMinimized) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isMinimized]);

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

  const handleToggleMinimize = () => {
    setIsMinimized(!isMinimized);
    if (onToggleCollapse) {
      onToggleCollapse();
    }
  };

  if (isMinimized) {
    return (
      <div className="absolute top-4 right-4 z-[1000]">
        <button
          onClick={handleToggleMinimize}
          className={`${
            theme === 'dark' ? 'bg-gray-800' : 'bg-white'
          } shadow-lg rounded-lg p-3 border ${
            theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
          } hover:shadow-xl transition-shadow`}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 6v12M6 12h12" />
            <circle cx="12" cy="12" r="3" fill="currentColor" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div className={`absolute top-4 right-4 z-[1000] w-80 ${
      theme === 'dark' ? 'bg-gray-800' : 'bg-white'
    } shadow-2xl rounded-lg border ${
      theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
    } flex flex-col`}
    style={{ maxHeight: 'calc(100vh - 200px)', height: '600px' }}
    >
      {/* Header */}
      <div className={`flex items-center justify-between p-3 border-b ${
        theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
      }`}>
        <h3 className="text-sm font-bold text-serpico-blue dark:text-serpico-blue-light">
          AI Assistant
        </h3>
        <button
          onClick={handleToggleMinimize}
          className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
          </svg>
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2" style={{ minHeight: 0 }}>
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-lg p-2 text-xs ${
                message.role === 'user'
                  ? 'bg-serpico-blue text-white'
                  : theme === 'dark'
                  ? 'bg-gray-700 text-gray-100'
                  : 'bg-gray-100 text-gray-900'
              }`}
            >
              {message.role === 'assistant' ? (
                <div className="prose prose-xs dark:prose-invert max-w-none">
                  <ReactMarkdown
                    components={{
                      p: ({ children }) => <p className="mb-1 last:mb-0 text-xs">{children}</p>,
                      ul: ({ children }) => <ul className="list-disc list-inside mb-1 space-y-0.5 text-xs">{children}</ul>,
                      ol: ({ children }) => <ol className="list-decimal list-inside mb-1 space-y-0.5 text-xs">{children}</ol>,
                      li: ({ children }) => <li className="ml-1 text-xs">{children}</li>,
                      h1: ({ children }) => <h1 className="text-sm font-bold mb-1">{children}</h1>,
                      h2: ({ children }) => <h2 className="text-xs font-bold mb-1">{children}</h2>,
                      h3: ({ children }) => <h3 className="text-xs font-bold mb-0.5">{children}</h3>,
                      code: ({ children, className }) => {
                        const isInline = !className;
                        return isInline ? (
                          <code className="bg-gray-800 dark:bg-gray-900 px-1 py-0.5 rounded text-xs">{children}</code>
                        ) : (
                          <code className="block bg-gray-800 dark:bg-gray-900 p-1 rounded text-xs overflow-x-auto">{children}</code>
                        );
                      },
                      pre: ({ children }) => <pre className="bg-gray-800 dark:bg-gray-900 p-1 rounded mb-1 overflow-x-auto text-xs">{children}</pre>,
                      strong: ({ children }) => <strong className="font-bold">{children}</strong>,
                      em: ({ children }) => <em className="italic">{children}</em>,
                      blockquote: ({ children }) => <blockquote className="border-l-2 border-gray-400 pl-1 italic mb-1 text-xs">{children}</blockquote>,
                    }}
                  >
                    {message.content}
                  </ReactMarkdown>
                </div>
              ) : (
                <p className="text-xs">{message.content}</p>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className={`rounded-lg p-2 ${
              theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
            }`}>
              <div className="flex space-x-1">
                <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" />
                <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className={`p-2 border-t ${
        theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
      }`}>
        <div className="flex space-x-1">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Type message..."
            className={`flex-1 px-2 py-1.5 text-xs rounded border ${
              theme === 'dark'
                ? 'bg-gray-700 border-gray-600 text-white'
                : 'bg-white border-gray-300'
            } focus:outline-none focus:ring-1 focus:ring-serpico-blue`}
          />
          <button
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className="bg-serpico-blue text-white px-3 py-1.5 text-xs rounded hover:bg-serpico-blue-dark disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
};

export default AIChatPanel;

