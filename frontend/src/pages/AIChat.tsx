import React, { useState, useRef, useEffect, useMemo } from 'react';
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
  context: string;
  pinned?: boolean;
}

const INTERVIEW_SESSION_ID = 'suspect-interview';
const INTERVIEW_CONTEXT = 'suspect-interview';

const interviewSession = (): ChatSession => ({
  id: INTERVIEW_SESSION_ID,
  title: 'Suspect Interview Helper',
  lastMessage: 'PEACE / SUE interview coaching — ask the first question…',
  timestamp: new Date(),
  context: INTERVIEW_CONTEXT,
  pinned: true,
});

const defaultGeneralSession = (): ChatSession => ({
  id: '1',
  title: 'Current Session',
  lastMessage: "Hello! I'm your Serpico AI assistant...",
  timestamp: new Date(),
  context: 'general',
});

const ensureInterviewSession = (list: ChatSession[]): ChatSession[] => {
  if (list.some((s) => s.id === INTERVIEW_SESSION_ID || s.context === INTERVIEW_CONTEXT)) {
    return list.map((s) =>
      s.id === INTERVIEW_SESSION_ID || s.context === INTERVIEW_CONTEXT
        ? { ...s, title: 'Suspect Interview Helper', context: INTERVIEW_CONTEXT, pinned: true }
        : s
    );
  }
  return [interviewSession(), ...list];
};

const GENERAL_SUGGESTIONS = [
  'Show me active pursuits in Olathe',
  'Find nearby suspects',
  'What are the recent cases?',
  'Help with pursuit strategy',
  'Search for perp information',
];

const INTERVIEW_SUGGESTIONS = [
  'Case brief: burglary at 3am, prints on window, suspect denies being there. Goal: timeline. Rights given.',
  'Suspect said: I was home all night. My thoughts: no alibi detail, avoid confrontation yet.',
  'Suspect said: I might have walked past that street. My thoughts: opening — probe route without showing evidence.',
  'Give me the next SUE probe — we have CCTV but have not disclosed it.',
  'Close the interview — summarize account and next steps.',
];

const AIChat: React.FC = () => {
  const location = useLocation();
  const { user } = useAuth();
  const { theme } = useTheme();
  const [sessions, setSessions] = useState<ChatSession[]>(() =>
    ensureInterviewSession([defaultGeneralSession()])
  );
  const [currentSessionId, setCurrentSessionId] = useState<string>(INTERVIEW_SESSION_ID);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const routeContext = () => {
    const path = location.pathname;
    if (path.includes('/in-pursue')) return 'in-pursue';
    if (path.includes('/board') || path.includes('/mysteries') || path.includes('/leisure')) return 'mysteries';
    if (path.includes('/chase-game')) return 'chase-game';
    if (path.includes('/nearby-officers')) return 'nearby-officers';
    if (path.includes('/nearby-perps')) return 'nearby-perps';
    if (path.includes('/safe-routes')) return 'safe-routes';
    return user?.role === 'police' ? 'in-pursue' : 'nearby-officers';
  };

  const currentSession = useMemo(
    () => sessions.find((s) => s.id === currentSessionId) || sessions[0],
    [sessions, currentSessionId]
  );

  const isInterview = currentSession?.context === INTERVIEW_CONTEXT;
  const context = isInterview
    ? INTERVIEW_CONTEXT
    : currentSession?.context && currentSession.context !== 'general'
      ? currentSession.context
      : routeContext();

  const userId = user?.id || 'guest';
  const suggestions = isInterview ? INTERVIEW_SUGGESTIONS : GENERAL_SUGGESTIONS;

  useEffect(() => {
    setMessages(loadChatHistory(userId, context, currentSessionId));
  }, [currentSessionId, userId, context]);

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

  const handleNewSession = () => {
    const id = `session-${Date.now().toString(36)}`;
    const next: ChatSession = {
      id,
      title: `Session ${sessions.filter((s) => !s.pinned).length + 1}`,
      lastMessage: 'New advisory session',
      timestamp: new Date(),
      context: routeContext(),
    };
    setSessions((prev) => ensureInterviewSession([next, ...prev]));
    setCurrentSessionId(id);
  };

  const handleSend = async (preset?: string) => {
    const text = (preset ?? input).trim();
    if (!text || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date(),
      context,
    };

    const priorHistory = historyForApi(messages);
    setMessages((prev) => [...prev, userMessage]);
    if (!preset) setInput('');
    setIsLoading(true);

    try {
      const response = await chatAPI.sendMessage(text, context, priorHistory);

      const aiMessage: Message = {
        id: response.response.id || (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.response.content,
        timestamp: new Date(response.response.timestamp || new Date()),
        context,
      };

      setMessages((prev) => [...prev, aiMessage]);

      setSessions((prev) =>
        prev.map((session) =>
          session.id === currentSessionId
            ? { ...session, lastMessage: text, timestamp: new Date(), context }
            : session
        )
      );
    } catch (error: any) {
      console.error('AI chat error:', error);

      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: error.response?.data?.error
          ? `**Heads up** — ${error.response.data.error}`
          : '**Copy that** — I hit a comms issue processing your request. Try again in a moment.',
        timestamp: new Date(),
        context,
      };

      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const [showSidebar, setShowSidebar] = useState(false);

  const placeholder = isInterview
    ? 'Suspect said: … / My thoughts: …  (or paste a case brief)'
    : 'Ask Officer Serpico…';

  return (
    <div className="page-fill min-h-0 flex overflow-hidden bg-synth-void">
      {/* Left Sidebar - Chat Sessions */}
      <div
        className={`hidden sm:flex w-64 border-r flex-shrink-0 ${
          theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
        } flex-col h-full`}
      >
        <div
          className={`p-4 border-b ${
            theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
          }`}
        >
          <h2 className="text-lg font-bold text-serpico-blue dark:text-serpico-blue-light">
            Chat Sessions
          </h2>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-2">
          {sessions.map((session) => (
            <button
              key={session.id}
              onClick={() => {
                setCurrentSessionId(session.id);
                setShowSidebar(false);
              }}
              className={`w-full text-left p-3 rounded-lg transition-colors ${
                currentSessionId === session.id
                  ? 'bg-serpico-blue bg-opacity-10 text-serpico-blue'
                  : theme === 'dark'
                    ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
            >
              <div className="font-medium text-sm truncate">{session.title}</div>
              <div
                className={`text-xs mt-1 truncate ${
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                }`}
              >
                {session.lastMessage}
              </div>
              <div
                className={`text-xs mt-1 ${
                  theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                }`}
              >
                {session.timestamp.toLocaleDateString()}
              </div>
            </button>
          ))}
        </div>

        <div
          className={`p-2 border-t ${
            theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
          }`}
        >
          <button
            type="button"
            onClick={handleNewSession}
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
        <div className="game-header p-3 sm:p-4 border-b border-white/10 flex-shrink-0">
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={() => setShowSidebar(!showSidebar)}
              className="sm:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 12h18M3 6h18M3 18h18" />
              </svg>
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg sm:text-2xl font-bold text-synth-text truncate">
                {isInterview ? 'Suspect Interview Helper' : 'Officer Serpico'}
              </h1>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1 hidden sm:block">
                {isInterview
                  ? 'PEACE · free recall · SUE — AI proposes questions; you report suspect answers + your thoughts'
                  : 'Olathe PD field advisor · Markdown intel briefs · Web search for crime data'}
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
              {isInterview ? (
                <span
                  className={`px-2 py-1 rounded text-xs font-medium ${
                    theme === 'dark' ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-700'
                  }`}
                >
                  Interview coach
                </span>
              ) : (
                <>
                  <span className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                    Intel:
                  </span>
                  <span
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      theme === 'dark' ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-700'
                    }`}
                  >
                    Records
                  </span>
                  <span
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      theme === 'dark' ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-700'
                    }`}
                  >
                    Web*
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Mobile session drawer */}
        {showSidebar && (
          <div className="sm:hidden border-b border-white/10 bg-synth-panel p-2 space-y-1 max-h-40 overflow-y-auto">
            {sessions.map((session) => (
              <button
                key={session.id}
                type="button"
                onClick={() => {
                  setCurrentSessionId(session.id);
                  setShowSidebar(false);
                }}
                className={`w-full text-left px-3 py-2 rounded text-sm ${
                  currentSessionId === session.id
                    ? 'bg-serpico-blue/20 text-serpico-blue'
                    : 'text-synth-muted'
                }`}
              >
                {session.title}
              </button>
            ))}
          </div>
        )}

        <div
          className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4"
          style={{ minHeight: 0, maxHeight: '100%' }}
        >
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] sm:max-w-[70%] rounded-lg p-2.5 sm:p-3 ${
                  message.role === 'user'
                    ? 'chat-user-bubble border border-white/15 text-synth-text'
                    : 'game-panel border border-white/10 text-synth-text'
                }`}
              >
                <ChatMarkdown content={message.content} size="sm" />
                <p className="text-xs mt-2 text-synth-muted">
                  {message.timestamp.toLocaleTimeString()}
                </p>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div
                className={`rounded-lg p-3 ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'}`}
              >
                <div className="flex space-x-2">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                  <div
                    className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                    style={{ animationDelay: '0.2s' }}
                  />
                  <div
                    className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                    style={{ animationDelay: '0.4s' }}
                  />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="game-header p-3 sm:p-4 border-t border-white/10 flex-shrink-0">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && void handleSend()}
              placeholder={placeholder}
              className={`flex-1 px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg border text-sm sm:text-base ${
                theme === 'dark'
                  ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                  : 'bg-white border-gray-300 placeholder-gray-500'
              } focus:outline-none focus:ring-2 focus:ring-serpico-blue`}
            />
            <button
              onClick={() => void handleSend()}
              disabled={isLoading || !input.trim()}
              className="bg-serpico-blue text-white px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg active:bg-serpico-blue-dark disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm sm:text-base touch-manipulation"
            >
              Send
            </button>
          </div>
          <div className="mt-2 hidden sm:flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <span>
              {isInterview
                ? 'Tip: Ask the suggested question, then reply with Suspect said + My thoughts'
                : 'Tip: Use suggestions on the right or type your question'}
            </span>
          </div>
        </div>
      </div>

      <div
        className={`hidden lg:flex w-48 border-l flex-shrink-0 ${
          theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
        } flex-col h-full overflow-hidden`}
      >
        <div className="p-3 flex-shrink-0">
          <h3
            className={`text-sm font-bold mb-3 ${
              theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
            }`}
          >
            {isInterview ? 'Interview prompts' : 'Suggestions'}
          </h3>
        </div>
        <div className="flex-1 overflow-y-auto px-3 pb-3">
          <div className="space-y-2">
            {suggestions.map((suggestion, index) => (
              <button
                key={index}
                type="button"
                onClick={() => setInput(suggestion)}
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
