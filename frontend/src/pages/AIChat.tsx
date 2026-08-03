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
  const [pickerOpen, setPickerOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (!pickerOpen) return;
    const onPointer = (e: MouseEvent | TouchEvent) => {
      const el = pickerRef.current;
      if (el && !el.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPickerOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('touchstart', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('touchstart', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [pickerOpen]);

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
    setPickerOpen(false);
  };

  const selectSession = (id: string) => {
    setCurrentSessionId(id);
    setPickerOpen(false);
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

  const placeholder = isInterview
    ? 'Suspect said: … / My thoughts: …  (or paste a case brief)'
    : 'Ask Officer Serpico…';

  const isDark = theme === 'dark';

  return (
    <div className="h-full min-h-0 flex flex-col overflow-hidden bg-synth-void">
      {/* Header with always-visible session picker */}
      <div className="game-header p-3 sm:p-4 border-b border-white/10 flex-shrink-0 relative z-30">
        <div className="flex items-center gap-2">
          <div className="flex-1 min-w-0 relative" ref={pickerRef}>
            <button
              type="button"
              onClick={() => setPickerOpen((v) => !v)}
              aria-expanded={pickerOpen}
              aria-haspopup="listbox"
              className={`w-full max-w-md flex items-center gap-2 px-3 py-2 rounded-lg border text-left touch-manipulation ${
                isDark
                  ? 'bg-gray-800 border-white/15 text-synth-text hover:border-white/30'
                  : 'bg-white border-gray-300 text-gray-900 hover:border-gray-400'
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="text-[10px] uppercase tracking-wider text-synth-muted">
                  Chat session
                </div>
                <div className="font-semibold text-sm sm:text-base truncate">
                  {currentSession?.title || 'Select session'}
                </div>
              </div>
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className={`flex-shrink-0 transition-transform ${pickerOpen ? 'rotate-180' : ''}`}
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>

            {pickerOpen && (
              <div
                role="listbox"
                className={`absolute left-0 right-0 mt-2 max-w-md rounded-xl border shadow-xl overflow-hidden z-40 ${
                  isDark
                    ? 'bg-gray-900 border-white/15'
                    : 'bg-white border-gray-200'
                }`}
              >
                <div className="max-h-[min(60vh,22rem)] overflow-y-auto p-2 space-y-1">
                  {sessions.map((session) => {
                    const active = session.id === currentSessionId;
                    return (
                      <button
                        key={session.id}
                        type="button"
                        role="option"
                        aria-selected={active}
                        onClick={() => selectSession(session.id)}
                        className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors touch-manipulation ${
                          active
                            ? 'bg-serpico-blue/20 text-serpico-blue'
                            : isDark
                              ? 'hover:bg-gray-800 text-gray-200'
                              : 'hover:bg-gray-100 text-gray-800'
                        }`}
                      >
                        <div className="font-medium text-sm truncate">{session.title}</div>
                        <div
                          className={`text-xs mt-0.5 truncate ${
                            isDark ? 'text-gray-400' : 'text-gray-500'
                          }`}
                        >
                          {session.lastMessage}
                        </div>
                      </button>
                    );
                  })}
                </div>
                <div
                  className={`p-2 border-t ${
                    isDark ? 'border-white/10' : 'border-gray-200'
                  }`}
                >
                  <button
                    type="button"
                    onClick={handleNewSession}
                    className={`w-full px-3 py-2 rounded-lg text-sm font-medium touch-manipulation ${
                      isDark
                        ? 'bg-gray-800 hover:bg-gray-700 text-gray-200'
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-800'
                    }`}
                  >
                    + New Session
                  </button>
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handleClearChat}
            className={`flex-shrink-0 px-2.5 py-2 rounded-lg text-xs font-medium touch-manipulation ${
              isDark
                ? 'bg-gray-800 hover:bg-gray-700 text-gray-300 border border-white/10'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200'
            }`}
            title="Clear chat history"
          >
            Clear
          </button>
        </div>
        <p className="text-xs text-synth-muted mt-2 hidden sm:block">
          {isInterview
            ? 'PEACE · free recall · SUE — AI proposes questions; you report suspect answers + your thoughts'
            : 'Olathe PD field advisor · Markdown intel briefs'}
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[90%] sm:max-w-[75%] rounded-lg p-2.5 sm:p-3 ${
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
            <div className={`rounded-lg p-3 ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}>
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

      {/* Suggestions (compact, always available) */}
      <div className="flex-shrink-0 px-3 pt-1 overflow-x-auto">
        <div className="flex gap-2 pb-1">
          {suggestions.slice(0, 3).map((suggestion, index) => (
            <button
              key={index}
              type="button"
              onClick={() => setInput(suggestion)}
              className={`flex-shrink-0 max-w-[16rem] truncate px-2.5 py-1.5 rounded-full text-[11px] border touch-manipulation ${
                isDark
                  ? 'bg-gray-800/80 border-white/10 text-gray-300'
                  : 'bg-gray-100 border-gray-200 text-gray-700'
              }`}
            >
              {suggestion}
            </button>
          ))}
        </div>
      </div>

      {/* Input */}
      <div className="game-header p-3 sm:p-4 border-t border-white/10 flex-shrink-0">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && void handleSend()}
            placeholder={placeholder}
            className={`flex-1 px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg border text-sm sm:text-base ${
              isDark
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
      </div>
    </div>
  );
};

export default AIChat;
