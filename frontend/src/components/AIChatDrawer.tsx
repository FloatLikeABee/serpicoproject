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

interface AIChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  context?: string;
}

const AIChatDrawer: React.FC<AIChatDrawerProps> = ({ isOpen, onClose, context }) => {
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

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

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
        <div className={`flex items-center justify-between p-3 sm:p-4 border-b ${
          theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
        }`}>
          <h2 className="text-lg sm:text-xl font-bold text-serpico-blue dark:text-serpico-blue-light">
            Officer Serpico
          </h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleClearChat}
              className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 px-2 py-1"
              title="Clear chat history"
            >
              Clear
            </button>
            <button
              onClick={onClose}
              className="text-gray-500 active:text-gray-700 dark:text-gray-400 dark:active:text-gray-200 touch-manipulation p-1"
            >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4" style={{ height: 'calc(100% - 140px)' }}>
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] sm:max-w-[80%] rounded-lg p-2.5 sm:p-3 ${
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
        <div className={`p-3 sm:p-4 border-t ${
          theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
        }`}>
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Ask Officer Serpico…"
              className={`flex-1 px-3 sm:px-4 py-2 rounded-lg border text-sm sm:text-base ${
                theme === 'dark'
                  ? 'bg-gray-700 border-gray-600 text-white'
                  : 'bg-white border-gray-300'
              } focus:outline-none focus:ring-2 focus:ring-serpico-blue`}
            />
            <button
              onClick={handleSend}
              disabled={isLoading || !input.trim()}
              className="bg-serpico-blue text-white px-3 sm:px-4 py-2 rounded-lg active:bg-serpico-blue-dark disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation text-sm sm:text-base font-medium"
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

