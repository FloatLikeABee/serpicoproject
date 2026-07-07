import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { chatAPI } from '../services/api';
import ChatMarkdown from './ChatMarkdown';
import {
  ChatMessage,
  clearChatHistory,
  createInitialMessages,
  historyForApi,
  loadChatHistory,
  saveChatHistory,
} from '../utils/chatHistory';

interface Message extends ChatMessage {}

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
  const { user } = useAuth();
  const { theme } = useTheme();
  const userId = user?.id || 'guest';
  const chatContext = context || 'general';

  const [messages, setMessages] = useState<Message[]>(() =>
    loadChatHistory(userId, chatContext)
  );
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isMinimized, setIsMinimized] = useState(isCollapsed);

  useEffect(() => {
    if (!isMinimized) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isMinimized]);

  useEffect(() => {
    setMessages(loadChatHistory(userId, chatContext));
  }, [userId, chatContext]);

  useEffect(() => {
    if (messages.length > 0) {
      saveChatHistory(userId, chatContext, messages);
    }
  }, [messages, userId, chatContext]);

  const handleClearChat = () => {
    clearChatHistory(userId, chatContext);
    setMessages(createInitialMessages(chatContext));
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    const messageText = input;
    const priorHistory = historyForApi(messages);
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Call backend AI API
      const response = await chatAPI.sendMessage(messageText, context, priorHistory);
      
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
          ? `**Heads up** — ${error.response.data.error}`
          : '**Copy that** — I hit a comms issue. Try again.',
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
          Officer Serpico
        </h3>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleClearChat}
            className="text-[10px] text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 px-1"
            title="Clear chat history"
          >
            Clear
          </button>
          <button
            onClick={handleToggleMinimize}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
          </svg>
          </button>
        </div>
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
              <ChatMarkdown
                content={message.content}
                size="xs"
                inverted={message.role === 'user'}
              />
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
            placeholder="Ask Officer Serpico…"
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

