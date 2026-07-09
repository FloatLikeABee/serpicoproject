import React, { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { chatAPI } from '../services/api';
import ChatMarkdown from '../components/ChatMarkdown';
import {
  ChatMessage,
  clearChatHistory,
  createInitialMessages,
  historyForApi,
  loadChatHistory,
  saveChatHistory,
} from '../utils/chatHistory';

interface Message extends ChatMessage {}

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
    if (path.includes('/board') || path.includes('/mysteries') || path.includes('/leisure')) return 'mysteries';
    if (path.includes('/chase-game')) return 'chase-game';
    if (path.includes('/nearby-officers')) return 'nearby-officers';
    if (path.includes('/nearby-perps')) return 'nearby-perps';
    if (path.includes('/safe-routes')) return 'safe-routes';
    return user?.role === 'police' ? 'in-pursue' : 'nearby-officers';
  };

  const userId = user?.id || 'guest';
  const context = getContext();

  // Load persisted history when session or context changes
  useEffect(() => {
    setMessages(loadChatHistory(userId, context, currentSessionId));
  }, [currentSessionId, userId, context]);

  // Persist history after each update
  useEffect(() => {
    if (messages.length > 0) {
      saveChatHistory(userId, context, messages, currentSessionId);
    }
  }, [messages, userId, context, currentSessionId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleClearChat = () => {
    clearChatHistory(userId, context, currentSessionId);
    setMessages(createInitialMessages(context));
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const chatContext = getContext();
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
      context: chatContext,
    };

    const messageText = input;
    const priorHistory = historyForApi(messages);
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await chatAPI.sendMessage(messageText, chatContext, priorHistory);
      
      const aiMessage: Message = {
        id: response.response.id || (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.response.content,
        timestamp: new Date(response.response.timestamp || new Date()),
        context: chatContext,
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
          ? `**Heads up** — ${error.response.data.error}`
          : '**Copy that** — I hit a comms issue processing your request. Try again in a moment.',
        timestamp: new Date(),
        context: chatContext,
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

  const [showSidebar, setShowSidebar] = useState(false);

  return (
    <div className={`h-full min-h-0 flex overflow-hidden ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'}`}>
      {/* Left Sidebar - Chat Sessions */}
      <div className={`hidden sm:flex w-64 border-r flex-shrink-0 ${
        theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
      } flex-col h-full`}>
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
        <div className={`p-3 sm:p-4 border-b flex-shrink-0 ${
          theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
        }`}>
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={() => setShowSidebar(!showSidebar)}
              className="sm:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 12h18M3 6h18M3 18h18"/>
              </svg>
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg sm:text-2xl font-bold text-serpico-blue dark:text-serpico-blue-light truncate">
                Officer Serpico
              </h1>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1 hidden sm:block">
                Olathe PD field advisor · Markdown intel briefs · Web search for crime data
              </p>
            </div>
            <div className="hidden sm:flex items-center gap-2">
              <button
                type="button"
                onClick={handleClearChat}
                className={`px-2.5 py-1 rounded text-xs font-medium touch-manipulation ${
                  theme === 'dark'
                    ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                    : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                }`}
                title="Clear chat history"
              >
                Clear chat
              </button>
              <span className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>Intel:</span>
              <div className="flex gap-1">
                <span
                  className={`px-2 py-1 rounded text-xs font-medium ${
                    theme === 'dark' ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-700'
                  }`}
                  title="Department records — always searched"
                >
                  Records
                </span>
                <span
                  className={`px-2 py-1 rounded text-xs font-medium ${
                    theme === 'dark' ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-700'
                  }`}
                  title="Live web search — auto-enabled for crime-data queries"
                >
                  Web*
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4" style={{ minHeight: 0, maxHeight: '100%' }}>
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] sm:max-w-[70%] rounded-lg p-2.5 sm:p-3 ${
                  message.role === 'user'
                    ? 'bg-serpico-blue text-white'
                    : theme === 'dark'
                    ? 'bg-gray-700 text-gray-100'
                    : 'bg-gray-100 text-gray-900'
                }`}
              >
                <ChatMarkdown
                  content={message.content}
                  size="sm"
                  inverted={message.role === 'user'}
                />
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
        <div className={`p-3 sm:p-4 border-t flex-shrink-0 ${
          theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
        }`}>
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
              placeholder="Ask Officer Serpico…"
              className={`flex-1 px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg border text-sm sm:text-base ${
                theme === 'dark'
                  ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                  : 'bg-white border-gray-300 placeholder-gray-500'
              } focus:outline-none focus:ring-2 focus:ring-serpico-blue`}
            />
            <button
              onClick={handleSend}
              disabled={isLoading || !input.trim()}
              className="bg-serpico-blue text-white px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg active:bg-serpico-blue-dark disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm sm:text-base touch-manipulation"
            >
              Send
            </button>
          </div>
          <div className="mt-2 hidden sm:flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <span>💡 Tip: Use suggestions on the right or type your question</span>
          </div>
        </div>
      </div>

      {/* Right Sidebar - Suggestions (hidden on mobile) */}
      <div className={`hidden lg:flex w-48 border-l flex-shrink-0 ${
        theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
      } flex-col h-full overflow-hidden`}>
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

