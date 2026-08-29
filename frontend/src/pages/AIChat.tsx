import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { chatAPI } from '../services/api';
import { parseNation } from '../utils/nation';
import { useT, useNation } from '../i18n/useT';
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
  lastMessage: 'Send a case brief to start…',
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

const AIChat: React.FC = () => {
  const location = useLocation();
  const { user } = useAuth();
  const { theme } = useTheme();
  const t = useT();
  const nation = useNation();
  const [sessions, setSessions] = useState<ChatSession[]>(() =>
    ensureInterviewSession([defaultGeneralSession()])
  );
  const [currentSessionId, setCurrentSessionId] = useState<string>(INTERVIEW_SESSION_ID);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
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
  const suggestions = isInterview
    ? [t('interview.chipBrief'), t('interview.chipSuspect')]
    : GENERAL_SUGGESTIONS;
  const isDark = theme === 'dark';

  const primaryTabs = useMemo(() => {
    const interview =
      sessions.find((s) => s.id === INTERVIEW_SESSION_ID || s.context === INTERVIEW_CONTEXT) ||
      interviewSession();
    const general =
      sessions.find((s) => s.id !== interview.id && (s.context === 'general' || s.id === '1')) ||
      sessions.find((s) => s.id !== interview.id) ||
      defaultGeneralSession();
    return [
      { id: interview.id, label: t('interview.tab'), full: t('interview.title') },
      { id: general.id, label: t('interview.general'), full: general.title },
    ];
  }, [sessions, t]);

  useEffect(() => {
    const loaded = loadChatHistory(userId, context, currentSessionId, nation);
    if (loaded.length === 1 && loaded[0].id === 'welcome') {
      setMessages(createInitialMessages(context, nation));
      return;
    }
    setMessages(loaded);
  }, [currentSessionId, userId, context, nation]);

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
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPickerOpen(false);
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [pickerOpen]);

  const handleClearChat = () => {
    clearChatHistory(userId, context, currentSessionId);
    setMessages(createInitialMessages(context, nation));
    if (isInterview) {
      setSessions((prev) =>
        prev.map((s) =>
          s.id === currentSessionId
            ? { ...s, lastMessage: t('interview.welcomeLast'), timestamp: new Date() }
            : s
        )
      );
    }
  };

  /** Clear interview history and return to case-brief gate. */
  const handleClearInterview = () => {
    clearChatHistory(userId, INTERVIEW_CONTEXT, INTERVIEW_SESSION_ID);
    setSessions((prev) =>
      prev.map((s) =>
        s.id === INTERVIEW_SESSION_ID || s.context === INTERVIEW_CONTEXT
          ? {
              ...s,
              id: INTERVIEW_SESSION_ID,
              title: t('interview.title'),
              lastMessage: t('interview.welcomeLast'),
              timestamp: new Date(),
              context: INTERVIEW_CONTEXT,
              pinned: true,
            }
          : s
      )
    );
    setCurrentSessionId(INTERVIEW_SESSION_ID);
    setMessages(createInitialMessages(INTERVIEW_CONTEXT, nation));
    setInput('');
    setPickerOpen(false);
  };

  const handleNewSession = () => {
    if (isInterview || currentSessionId === INTERVIEW_SESSION_ID) {
      handleClearInterview();
      return;
    }
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
      const response = await chatAPI.sendMessage(text, context, priorHistory, {
        nation: parseNation(user?.nation),
        userId: user?.id,
      });

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
          ? `${t('chat.headsUpPrefix')} ${error.response.data.error}`
          : t('chat.commsIssue'),
        timestamp: new Date(),
        context,
      };

      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const placeholder = isInterview ? t('interview.placeholder') : t('chat.placeholder');

  const sessionSheet =
    pickerOpen &&
    createPortal(
      <div
        className="fixed inset-0 z-[10000] flex flex-col justify-end sm:justify-center sm:items-center"
        role="dialog"
        aria-modal="true"
        aria-label="Chat sessions"
      >
        <button
          type="button"
          className="absolute inset-0 bg-black/70"
          aria-label="Close sessions"
          onClick={() => setPickerOpen(false)}
        />
        <div
          className={`relative z-[10001] w-full sm:max-w-md sm:mx-4 max-h-[80dvh] flex flex-col rounded-t-2xl sm:rounded-2xl border shadow-2xl ${
            isDark ? 'bg-gray-950 border-white/15' : 'bg-white border-gray-200'
          }`}
        >
          <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-white/10">
            <h2 className="font-display text-sm uppercase tracking-wider text-synth-text">
              Chat sessions
            </h2>
            <button
              type="button"
              onClick={() => setPickerOpen(false)}
              className={`px-3 py-1.5 rounded-lg text-sm touch-manipulation ${
                isDark ? 'bg-gray-800 text-gray-200' : 'bg-gray-100 text-gray-800'
              }`}
            >
              Close
            </button>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2">
            {sessions.map((session) => {
              const active = session.id === currentSessionId;
              return (
                <button
                  key={session.id}
                  type="button"
                  onClick={() => selectSession(session.id)}
                  className={`w-full text-left px-4 py-3 rounded-xl border transition-colors touch-manipulation ${
                    active
                      ? 'border-serpico-blue bg-serpico-blue/15 text-serpico-blue'
                      : isDark
                        ? 'border-white/10 bg-gray-900 text-gray-200 active:bg-gray-800'
                        : 'border-gray-200 bg-gray-50 text-gray-900 active:bg-gray-100'
                  }`}
                >
                  <div className="font-semibold text-sm">
                    {session.context === INTERVIEW_CONTEXT ? t('interview.title') : session.title}
                  </div>
                  <div
                    className={`text-xs mt-1 line-clamp-2 ${
                      isDark ? 'text-gray-400' : 'text-gray-500'
                    }`}
                  >
                    {session.lastMessage}
                  </div>
                </button>
              );
            })}
          </div>
          <div className="p-3 border-t border-white/10 space-y-2 safe-area-inset-bottom">
            <button
              type="button"
              onClick={handleClearInterview}
              className={`w-full px-4 py-2.5 rounded-xl text-sm font-semibold border touch-manipulation ${
                isDark
                  ? 'border-white/15 bg-gray-900 text-gray-200'
                  : 'border-gray-200 bg-gray-50 text-gray-800'
              }`}
            >
              {t('interview.clearNew')}
            </button>
            <button
              type="button"
              onClick={handleNewSession}
              className="w-full px-4 py-2.5 rounded-xl text-sm font-semibold bg-serpico-blue text-white touch-manipulation"
            >
              {isInterview ? t('interview.new') : '+ New Session'}
            </button>
          </div>
        </div>
      </div>,
      document.body
    );

  return (
    <div className="h-full min-h-0 flex flex-col overflow-hidden bg-synth-void">
      <div className="game-header flex-shrink-0 border-b border-white/10">
        <div className="px-2.5 py-1.5 flex items-center gap-1.5">
          <div
            className={`flex-1 flex p-0.5 rounded-lg border min-w-0 ${
              isDark ? 'bg-black/40 border-white/10' : 'bg-gray-100 border-gray-200'
            }`}
            role="tablist"
            aria-label="Primary chat sessions"
          >
            {primaryTabs.map((tab) => {
              const active = tab.id === currentSessionId;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  title={tab.full}
                  onClick={() => selectSession(tab.id)}
                  className={`flex-1 min-w-0 px-2 py-1 rounded-md text-[11px] font-semibold touch-manipulation transition-colors ${
                    active
                      ? 'bg-serpico-blue text-white'
                      : isDark
                        ? 'text-gray-300 active:bg-white/5'
                        : 'text-gray-700 active:bg-white'
                  }`}
                >
                  <span className="truncate block">{tab.label}</span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className={`flex-shrink-0 px-2 py-1 rounded-md text-[11px] font-semibold border touch-manipulation ${
              isDark
                ? 'bg-gray-800 border-white/15 text-gray-200'
                : 'bg-white border-gray-300 text-gray-800'
            }`}
            aria-label={t('interview.all')}
          >
            {t('interview.all')}
          </button>

          {isInterview ? (
            <button
              type="button"
              onClick={handleClearInterview}
              className={`flex-shrink-0 px-2 py-1 rounded-md text-[11px] font-semibold border touch-manipulation ${
                isDark
                  ? 'bg-gray-800 border-white/15 text-gray-200'
                  : 'bg-gray-100 border-gray-200 text-gray-700'
              }`}
              title={t('interview.clearNew')}
            >
              {t('chat.clear')}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleClearChat}
              className={`flex-shrink-0 px-2 py-1 rounded-md text-[11px] font-semibold border touch-manipulation ${
                isDark
                  ? 'bg-gray-800 border-white/15 text-gray-200'
                  : 'bg-gray-100 border-gray-200 text-gray-700'
              }`}
              title={t('chat.clear')}
            >
              {t('chat.clear')}
            </button>
          )}
        </div>
      </div>

      {sessionSheet}

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
            {t('chat.send')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AIChat;
