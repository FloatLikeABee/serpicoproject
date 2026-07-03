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

  const getContext = () => {
    const path = location.pathname;
    if (path.includes('/in-pursue')) return 'in-pursue';
    if (path.includes('/perps-cases') || path.includes('/perps') || path.includes('/case-library')) return 'perps-cases';
    if (path.includes('/emergency')) return 'emergency';
    if (path.includes('/mysteries') || path.includes('/leisure')) return 'mysteries';
    if (path.includes('/chase-game')) return 'chase-game';
    if (path.includes('/nearby-officers')) return 'nearby-officers';
    if (path.includes('/nearby-perps')) return 'nearby-perps';
    if (path.includes('/safe-routes')) return 'safe-routes';
    if (path.includes('/crime-notifications')) return 'crime-notifications';
    return user?.role === 'police' ? 'in-pursue' : 'nearby-officers';
  };

  const getInitialMessage = (context?: string) => {
    const contextMessages: Record<string, string> = {
      'in-pursue': 'Hello! I\'m your Serpico AI assistant for Olathe PD. I can help you with active pursuits, suspect locations, and pursuit strategies. How can I assist you?',
      'perps-cases': 'Hello! I can help you search for information about serial killers and their cases across North America. What would you like to know?',
      'perps': 'Hello! I can help you search for information about serial killers across North America. What would you like to know?',
      'case-library': 'Hello! I can help you search through serial killer case history. What case information are you looking for?',
      'emergency': 'Hello! I can help you with emergency dispatch information and recommendations. How can I assist?',
      'mysteries': 'Hello! I can help you explore serial killers, paranormal phenomena, urban legends, and conspiracy theories across North America. What mystery interests you?',
      'leisure': 'Hello! I can help you explore serial killers, paranormal phenomena, urban legends, and conspiracy theories across North America. What mystery interests you?',
      'nearby-officers': 'Hello! I can help you find information about nearby Olathe PD officers and their locations. How can I help?',
      'nearby-perps': 'Hello! I can provide information about recent criminal activity in Olathe. What would you like to know?',
      'safe-routes': 'Hello! I can help you find safe routes in Olathe based on recent crime data. Where would you like to go?',
      'crime-notifications': 'Hello! I can help you understand recent crime notifications in Olathe. What information do you need?',
      'chase-game': 'Hello! Ready for pursuit training? I can explain Chase Game rules, pursuit codex tips, and debrief your strategy. Or head to the Chase tab to start a live scenario!',
    };
    return contextMessages[context || ''] || 'Hello! I\'m your Serpico AI assistant for Olathe PD. How can I help you today?';
  };

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

      setSessions(prev => prev.map(session =>
        session.id === currentSessionId
          ? { ...session, lastMessage: messageText, timestamp: new Date() }
          : session
      ));
    } catch (error: unknown) {
      console.error('AI chat error:', error);
      const err = error as { response?: { data?: { error?: string } } };
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: err.response?.data?.error
          ? `Error: ${err.response.data.error}`
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
    <div className="ai-chat-layout">
      {/* Left Sidebar — desktop only */}
      <div className={`hidden sm:flex w-56 lg:w-64 border-r flex-shrink-0 flex-col min-h-0 ${
        theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
      }`}>
        <div className="game-header p-3 flex-shrink-0">
          <h2 className="text-sm font-display font-bold text-serpico-blue neon-text-cyan">
            Sessions
          </h2>
        </div>

        <div className="scroll-area p-2 space-y-2">
          {sessions.map((session) => (
            <button
              key={session.id}
              type="button"
              onClick={() => setCurrentSessionId(session.id)}
              className={`w-full text-left p-2.5 rounded-lg transition-colors ${
                currentSessionId === session.id
                  ? 'bg-serpico-blue bg-opacity-10 text-serpico-blue border border-neon-cyan/30'
                  : theme === 'dark'
                  ? 'bg-gray-700/50 hover:bg-gray-600 text-gray-300'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
            >
              <div className="font-medium text-xs truncate">{session.title}</div>
              <div className="text-[10px] mt-1 truncate text-gray-400">{session.lastMessage}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Main chat column — fills remaining height */}
      <div className="flex flex-1 flex-col min-h-0 min-w-0 overflow-hidden">
        <div className="game-header p-2 sm:p-3 flex-shrink-0">
          <h1 className="text-base sm:text-lg font-display font-bold text-serpico-blue neon-text-cyan truncate">
            AI Assistant
          </h1>
          <p className="text-[10px] sm:text-xs text-gray-400 mt-0.5 truncate hidden sm:block">
            Serial killers, mysteries & pursuit intel
          </p>
        </div>

        <div className="scroll-area flex-1 p-2 sm:p-3 space-y-2 sm:space-y-3">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[90%] sm:max-w-[75%] rounded-lg p-2 sm:p-2.5 ${
                  message.role === 'user'
                    ? 'bg-serpico-blue text-white'
                    : theme === 'dark'
                    ? 'bg-gray-700/90 text-gray-100 border border-neon-purple/20'
                    : 'bg-gray-100 text-gray-900'
                }`}
              >
                {message.role === 'assistant' ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none text-sm">
                    <ReactMarkdown
                      components={{
                        p: ({ children }) => <p className="mb-1.5 last:mb-0">{children}</p>,
                        ul: ({ children }) => <ul className="list-disc list-inside mb-1.5 space-y-0.5">{children}</ul>,
                        ol: ({ children }) => <ol className="list-decimal list-inside mb-1.5 space-y-0.5">{children}</ol>,
                        li: ({ children }) => <li className="ml-1">{children}</li>,
                        code: ({ children, className }) => {
                          const isInline = !className;
                          return isInline ? (
                            <code className="bg-gray-900 px-1 py-0.5 rounded text-xs">{children}</code>
                          ) : (
                            <code className="block bg-gray-900 p-2 rounded mb-1.5 overflow-x-auto text-xs">{children}</code>
                          );
                        },
                      }}
                    >
                      {message.content}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <p className="text-sm">{message.content}</p>
                )}
                <p className={`text-[10px] mt-1 ${message.role === 'user' ? 'text-blue-100/70' : 'text-gray-500'}`}>
                  {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className={`rounded-lg p-2.5 ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'}`}>
                <div className="flex space-x-1.5">
                  <div className="w-1.5 h-1.5 bg-neon-cyan rounded-full animate-bounce" />
                  <div className="w-1.5 h-1.5 bg-neon-cyan rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                  <div className="w-1.5 h-1.5 bg-neon-cyan rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input — pinned to bottom of chat column */}
        <div className="flex-shrink-0 game-header border-t border-neon-purple/20 p-2 sm:p-3">
          <div className="flex gap-2 items-center">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
              placeholder="Type your message..."
              className="synth-input flex-1 min-w-0 py-2 text-sm"
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={isLoading || !input.trim()}
              className="btn-neon-primary px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm flex-shrink-0 disabled:opacity-50"
            >
              Send
            </button>
          </div>
        </div>
      </div>

      {/* Right suggestions — large desktop only */}
      <div className={`hidden lg:flex w-44 border-l flex-shrink-0 flex-col min-h-0 ${
        theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
      }`}>
        <div className="game-header p-3 flex-shrink-0">
          <h3 className="text-xs font-display font-bold text-synth-muted uppercase tracking-wider">
            Suggestions
          </h3>
        </div>
        <div className="scroll-area px-2 pb-2 space-y-1.5">
          {suggestions.map((suggestion, index) => (
            <button
              key={index}
              type="button"
              onClick={() => setInput(suggestion)}
              className={`w-full text-left p-2 rounded-lg text-[10px] leading-snug ${
                theme === 'dark'
                  ? 'bg-gray-700/50 hover:bg-gray-600 text-gray-300 border border-neon-purple/20'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              } transition-colors`}
            >
              {suggestion}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AIChat;
