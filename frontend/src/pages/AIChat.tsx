import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { chatAPI } from '../services/api';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  context?: string;
}

interface ChatSession {
  id: string;
  title: string;
  lastMessage: string;
  timestamp: Date;
  context?: string;
}

const AIChat: React.FC = () => {
  const location = useLocation();
  const { user } = useAuth();
  const { theme } = useTheme();
  const [sessions, setSessions] = useState<ChatSession[]>([
    {
      id: '1',
      title: 'Current Session',
      lastMessage: 'Hello! I\'m your Serpico AI assistant...',
      timestamp: new Date(),
      context: 'general',
    },
  ]);
  const [currentSessionId, setCurrentSessionId] = useState<string>('1');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Get context from current route
  const getContext = () => {
    const path = location.pathname;
    if (path.includes('/in-pursue')) return 'in-pursue';
    if (path.includes('/perps-cases') || path.includes('/perps') || path.includes('/case-library')) return 'perps-cases';
    if (path.includes('/emergency')) return 'emergency';
    if (path.includes('/leisure')) return 'leisure';
    if (path.includes('/nearby-officers')) return 'nearby-officers';
    if (path.includes('/nearby-perps')) return 'nearby-perps';
    if (path.includes('/safe-routes')) return 'safe-routes';
    if (path.includes('/crime-notifications')) return 'crime-notifications';
    return user?.role === 'police' ? 'in-pursue' : 'nearby-officers';
  };

  const getInitialMessage = (context?: string) => {
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

  // Initialize messages for current session
  useEffect(() => {
    const context = getContext();
    const initialMessage: Message = {
      id: '1',
      role: 'assistant',
      content: getInitialMessage(context),
      timestamp: new Date(),
      context,
    };
    setMessages([initialMessage]);
  }, [currentSessionId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const context = getContext();
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
      context,
    };

    const messageText = input;
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await chatAPI.sendMessage(messageText, context);
      
      const aiMessage: Message = {
        id: response.response.id || (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.response.content,
        timestamp: new Date(response.response.timestamp || new Date()),
        context,
      };
      
      setMessages(prev => [...prev, aiMessage]);
      
      // Update session last message
      setSessions(prev => prev.map(session => 
        session.id === currentSessionId 
          ? { ...session, lastMessage: messageText, timestamp: new Date() }
          : session
      ));
    } catch (error: any) {
      console.error('AI chat error:', error);
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: error.response?.data?.error 
          ? `Error: ${error.response.data.error}` 
          : 'Sorry, I encountered an error processing your request. Please try again.',
        timestamp: new Date(),
        context,
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const suggestions = [
    'Show me active pursuits in Olathe',
    'Find nearby suspects',
    'What are the recent cases?',
    'Help with pursuit strategy',
    'Search for perp information',
  ];

  return (
    <div className={`h-screen flex ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'}`} style={{ paddingBottom: '80px', overflow: 'hidden' }}>
      {/* Left Sidebar - Chat Sessions */}
      <div className={`w-64 border-r flex-shrink-0 ${
        theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
      } flex flex-col h-full`}>
        <div className={`p-4 border-b ${
          theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
        }`}>
          <h2 className="text-lg font-bold text-serpico-blue dark:text-serpico-blue-light">
            Chat Sessions
          </h2>
        </div>
        
        <div className="flex-1 overflow-y-auto p-2 space-y-2">
          {sessions.map((session) => (
            <button
              key={session.id}
              onClick={() => setCurrentSessionId(session.id)}
              className={`w-full text-left p-3 rounded-lg transition-colors ${
                currentSessionId === session.id
                  ? 'bg-serpico-blue bg-opacity-10 text-serpico-blue'
                  : theme === 'dark'
                  ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
            >
              <div className="font-medium text-sm truncate">{session.title}</div>
              <div className={`text-xs mt-1 truncate ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
              }`}>
                {session.lastMessage}
              </div>
              <div className={`text-xs mt-1 ${
                theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
              }`}>
                {session.timestamp.toLocaleDateString()}
              </div>
            </button>
          ))}
        </div>

        <div className={`p-2 border-t ${
          theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
        }`}>
          <button
            className={`w-full px-3 py-2 rounded-lg text-sm font-medium ${
              theme === 'dark'
                ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
            }`}
          >
            + New Session
          </button>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col h-full min-w-0">
        {/* Header */}
        <div className={`p-4 border-b flex-shrink-0 ${
          theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-serpico-blue dark:text-serpico-blue-light">
                AI Assistant
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Your intelligent assistant for Olathe PD operations
              </p>
            </div>
            {/* Tools Selection */}
            <div className="flex items-center gap-2">
              <span className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>Tools:</span>
              <div className="flex gap-1">
                <button
                  className={`px-2 py-1 rounded text-xs font-medium ${
                    theme === 'dark'
                      ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                      : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                  }`}
                  title="RAG Database - Crime data search"
                >
                  RAG
                </button>
                <button
                  className={`px-2 py-1 rounded text-xs font-medium ${
                    theme === 'dark'
                      ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                      : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                  }`}
                  title="Web Search - Latest online information"
                >
                  Web
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4" style={{ minHeight: 0, maxHeight: '100%' }}>
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[70%] rounded-lg p-3 ${
                  message.role === 'user'
                    ? 'bg-serpico-blue text-white'
                    : theme === 'dark'
                    ? 'bg-gray-700 text-gray-100'
                    : 'bg-gray-100 text-gray-900'
                }`}
              >
                {message.role === 'assistant' ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none">
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
                            <code className="block bg-gray-800 dark:bg-gray-900 p-2 rounded mb-2 overflow-x-auto">{children}</code>
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
                <p className={`text-xs mt-2 ${
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
        <div className={`p-4 border-t flex-shrink-0 ${
          theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
        }`}>
          <div className="flex space-x-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
              placeholder="Type your message... (Press Enter to send)"
              className={`flex-1 px-4 py-3 rounded-lg border ${
                theme === 'dark'
                  ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                  : 'bg-white border-gray-300 placeholder-gray-500'
              } focus:outline-none focus:ring-2 focus:ring-serpico-blue`}
            />
            <button
              onClick={handleSend}
              disabled={isLoading || !input.trim()}
              className="bg-serpico-blue text-white px-6 py-3 rounded-lg hover:bg-serpico-blue-dark disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              Send
            </button>
          </div>
          <div className="mt-2 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <span>💡 Tip: Use suggestions on the right or type your question</span>
          </div>
        </div>
      </div>

      {/* Right Sidebar - Suggestions */}
      <div className={`w-48 border-l flex-shrink-0 ${
        theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
      } flex flex-col h-full overflow-hidden`}>
        <div className="p-3 flex-shrink-0">
          <h3 className={`text-sm font-bold mb-3 ${
            theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
          }`}>
            Suggestions
          </h3>
        </div>
        <div className="flex-1 overflow-y-auto px-3 pb-3">
          <div className="space-y-2">
            {suggestions.map((suggestion, index) => (
              <button
                key={index}
                onClick={() => {
                  setInput(suggestion);
                  // Auto-send could be added here if desired
                }}
                className={`w-full text-left p-2 rounded text-xs ${
                  theme === 'dark'
                    ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                } transition-colors`}
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIChat;

