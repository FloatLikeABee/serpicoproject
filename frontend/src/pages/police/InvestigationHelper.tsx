import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { parseNation } from '../../utils/nation';
import { useT } from '../../i18n/useT';
import { useTheme } from '../../contexts/ThemeContext';
import ChatMarkdown from '../../components/ChatMarkdown';
import {
  InvestigationHelperFile,
  InvestigationHelperMessage,
  InvestigationHelperSession,
  investigationHelperAPI,
} from '../../services/api';

const InvestigationHelper: React.FC = () => {
  const { user } = useAuth();
  const { theme } = useTheme();
  const t = useT();
  const userId = user?.id || 'guest';
  const isDark = theme === 'dark';

  const [sessions, setSessions] = useState<InvestigationHelperSession[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<InvestigationHelperMessage[]>([]);
  const [files, setFiles] = useState<InvestigationHelperFile[]>([]);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [summary, setSummary] = useState('');
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const applyPayload = useCallback(
    (payload: {
      session: InvestigationHelperSession;
      messages: InvestigationHelperMessage[];
      files: InvestigationHelperFile[];
    }) => {
      setActiveId(payload.session.id);
      setTitle(payload.session.title);
      setNotes(payload.session.notes || '');
      setSummary(payload.session.summary || '');
      setMessages(payload.messages || []);
      setFiles(payload.files || []);
    },
    []
  );

  const apiErrorMessage = (err: unknown, fallback: string) => {
    const anyErr = err as { response?: { data?: { error?: string }; status?: number }; message?: string };
    if (anyErr?.response?.data?.error) return anyErr.response.data.error;
    if (anyErr?.response?.status === 404) return 'Investigation Helper API not found — backend may still be deploying.';
    if (anyErr?.message?.includes('Network')) return 'Network error reaching the API (CORS or offline).';
    return fallback;
  };

  const refreshList = useCallback(async () => {
    try {
      const { sessions: list } = await investigationHelperAPI.listSessions(userId);
      setSessions(list || []);
      return list || [];
    } catch (err) {
      console.error(err);
      setError(apiErrorMessage(err, 'Could not load investigation sessions.'));
      return [];
    }
  }, [userId]);

  const openSession = useCallback(
    async (sessionId: string) => {
      setLoading(true);
      setError('');
      try {
        const payload = await investigationHelperAPI.getSession(userId, sessionId);
        applyPayload(payload);
        setListOpen(false);
      } catch (err) {
        console.error(err);
        setError(apiErrorMessage(err, 'Could not open session.'));
      } finally {
        setLoading(false);
      }
    },
    [applyPayload, userId]
  );

  const startNewSession = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const payload = await investigationHelperAPI.createSession(userId);
      applyPayload(payload);
      await refreshList();
      setListOpen(false);
    } catch (err) {
      console.error(err);
      setError(apiErrorMessage(err, 'Could not create session.'));
    } finally {
      setLoading(false);
    }
  }, [applyPayload, refreshList, userId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const list = await refreshList();
      if (cancelled) return;
      if (list.length > 0) {
        await openSession(list[0].id);
      } else {
        await startNewSession();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const saveMeta = async () => {
    if (!activeId) return;
    setLoading(true);
    setError('');
    try {
      const payload = await investigationHelperAPI.updateSession(userId, activeId, {
        title: title.trim() || 'Investigation',
        summary,
        notes,
      });
      applyPayload(payload);
      await refreshList();
      setEditOpen(false);
    } catch (err) {
      console.error(err);
      setError('Could not save session revisions.');
    } finally {
      setLoading(false);
    }
  };

  const deleteActive = async () => {
    if (!activeId) return;
    if (!window.confirm('Delete this investigation session and its uploads?')) return;
    setLoading(true);
    try {
      await investigationHelperAPI.deleteSession(userId, activeId);
      const list = await refreshList();
      if (list.length > 0) {
        await openSession(list[0].id);
      } else {
        await startNewSession();
      }
    } catch (err) {
      console.error(err);
      setError('Could not delete session.');
    } finally {
      setLoading(false);
    }
  };

  const onUpload = async (fileList: FileList | null) => {
    if (!activeId || !fileList?.length) return;
    setUploading(true);
    setError('');
    try {
      for (const file of Array.from(fileList)) {
        const { file: uploaded } = await investigationHelperAPI.uploadFile(userId, activeId, file);
        setFiles((prev) => [...prev, uploaded]);
      }
      await refreshList();
    } catch (err) {
      console.error(err);
      setError('Upload failed. Try a smaller image/file (max 12MB).');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeFile = async (fileId: string) => {
    if (!activeId) return;
    try {
      await investigationHelperAPI.deleteFile(userId, activeId, fileId);
      setFiles((prev) => prev.filter((f) => f.id !== fileId));
    } catch (err) {
      console.error(err);
      setError('Could not remove file.');
    }
  };

  const sendMessage = async () => {
    if (!activeId || !input.trim() || loading) return;
    const text = input.trim();
    setInput('');
    setLoading(true);
    setError('');
    const optimistic: InvestigationHelperMessage = {
      id: `local-${Date.now()}`,
      sessionId: activeId,
      role: 'user',
      content: text,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    try {
      const payload = await investigationHelperAPI.chat(userId, activeId, text, parseNation(user?.nation));
      applyPayload(payload);
      await refreshList();
    } catch (err) {
      console.error(err);
      setError('AI brainstorm failed. Try again.');
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setInput(text);
    } finally {
      setLoading(false);
    }
  };

  const muted = isDark ? 'text-gray-400' : 'text-gray-600';

  return (
    <div className="h-full min-h-0 flex flex-col overflow-hidden">
      <div className="flex-shrink-0 px-2.5 py-1.5 border-b border-white/10 flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => setListOpen(true)}
          className={`min-w-0 flex-1 text-left px-2 py-1.5 rounded-lg border text-xs touch-manipulation ${
            isDark ? 'bg-gray-900 border-white/10 text-synth-text' : 'bg-white border-gray-200 text-gray-900'
          }`}
        >
          <div className="text-[9px] uppercase tracking-wider text-synth-muted">{t('helper.session')}</div>
          <div className="font-semibold truncate">{title || 'Investigation'}</div>
        </button>
        <button
          type="button"
          onClick={() => setEditOpen(true)}
          className={`px-2 py-1.5 rounded-lg text-[11px] font-semibold border touch-manipulation ${
            isDark ? 'border-white/15 text-gray-200' : 'border-gray-200 text-gray-700'
          }`}
        >
          {t('helper.revise')}
        </button>
        <button
          type="button"
          onClick={() => void startNewSession()}
          className="px-2 py-1.5 rounded-lg text-[11px] font-semibold bg-serpico-blue text-white touch-manipulation"
        >
          {t('helper.new')}
        </button>
      </div>

      {error && (
        <div className="flex-shrink-0 mx-2.5 mt-2 p-2 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-xs">
          {error}
        </div>
      )}

      {/* Evidence strip */}
      <div className="flex-shrink-0 px-2.5 py-2 border-b border-white/10">
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <p className={`text-[10px] uppercase tracking-wide font-semibold ${muted}`}>
            {t('helper.files')}
          </p>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={!activeId || uploading}
            className="text-[11px] font-semibold text-serpico-blue touch-manipulation disabled:opacity-50"
          >
            {uploading ? t('helper.uploading') : t('helper.upload')}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf,.txt,.md,.csv,.json,.doc,.docx"
            multiple
            className="hidden"
            onChange={(e) => void onUpload(e.target.files)}
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {files.length === 0 && (
            <p className={`text-xs ${muted}`}>{t('helper.emptyFiles')}</p>
          )}
          {files.map((f) => {
            const isImage = (f.mimeType || '').startsWith('image/');
            return (
              <div
                key={f.id}
                className={`relative flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border ${
                  isDark ? 'border-white/10 bg-gray-900' : 'border-gray-200 bg-gray-100'
                }`}
              >
                {isImage ? (
                  <img
                    src={investigationHelperAPI.fileUrl(f.url, userId)}
                    alt={f.filename}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center p-1 text-[9px] text-center text-synth-muted">
                    {f.filename}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => void removeFile(f.id)}
                  className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/70 text-white text-[10px] touch-manipulation"
                  aria-label={`Remove ${f.filename}`}
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Brainstorm thread */}
      <div className="flex-1 min-h-0 overflow-y-auto p-2.5 space-y-2.5">
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[92%] rounded-lg p-2.5 text-sm ${
                m.role === 'user'
                  ? 'chat-user-bubble border border-white/15'
                  : 'game-panel border border-white/10'
              }`}
            >
              <ChatMarkdown content={m.content} size="sm" />
            </div>
          </div>
        ))}
        {loading && (
          <div className={`text-xs ${muted}`}>Working the case…</div>
        )}
        <div ref={endRef} />
      </div>

      <div className="flex-shrink-0 p-2.5 border-t border-white/10">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && void sendMessage()}
            placeholder="Brainstorm facts, ask for leads, or request interview questions…"
            className={`flex-1 px-3 py-2.5 rounded-lg border text-sm ${
              isDark
                ? 'bg-gray-800 border-gray-600 text-white placeholder-gray-400'
                : 'bg-white border-gray-300 placeholder-gray-500'
            }`}
          />
          <button
            type="button"
            onClick={() => void sendMessage()}
            disabled={loading || !input.trim()}
            className="px-4 py-2.5 rounded-lg bg-serpico-blue text-white text-sm font-semibold disabled:opacity-50 touch-manipulation"
          >
            Send
          </button>
        </div>
      </div>

      {/* Session list sheet */}
      {listOpen && (
        <div className="fixed inset-0 z-[10000] flex flex-col justify-end sm:justify-center sm:items-center">
          <button type="button" className="absolute inset-0 bg-black/70" onClick={() => setListOpen(false)} aria-label="Close" />
          <div
            className={`relative z-[10001] w-full sm:max-w-md max-h-[75dvh] flex flex-col rounded-t-2xl sm:rounded-2xl border ${
              isDark ? 'bg-gray-950 border-white/15' : 'bg-white border-gray-200'
            }`}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <h2 className="text-sm font-display uppercase tracking-wider">Sessions</h2>
              <button type="button" className="text-sm px-2 py-1" onClick={() => setListOpen(false)}>
                Close
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {sessions.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => void openSession(s.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-xl border touch-manipulation ${
                    s.id === activeId
                      ? 'border-serpico-blue bg-serpico-blue/15 text-serpico-blue'
                      : isDark
                        ? 'border-white/10 bg-gray-900 text-gray-200'
                        : 'border-gray-200 bg-gray-50'
                  }`}
                >
                  <div className="font-semibold text-sm truncate">{s.title}</div>
                  <div className={`text-[11px] mt-0.5 ${muted}`}>
                    {new Date(s.updatedAt).toLocaleString()}
                  </div>
                </button>
              ))}
            </div>
            <div className="p-3 border-t border-white/10">
              <button
                type="button"
                onClick={() => void startNewSession()}
                className="w-full py-2.5 rounded-xl bg-serpico-blue text-white text-sm font-semibold"
              >
                + New investigation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Revise sheet */}
      {editOpen && (
        <div className="fixed inset-0 z-[10000] flex flex-col justify-end sm:justify-center sm:items-center">
          <button type="button" className="absolute inset-0 bg-black/70" onClick={() => setEditOpen(false)} aria-label="Close" />
          <div
            className={`relative z-[10001] w-full sm:max-w-md max-h-[80dvh] flex flex-col rounded-t-2xl sm:rounded-2xl border ${
              isDark ? 'bg-gray-950 border-white/15' : 'bg-white border-gray-200'
            }`}
          >
            <div className="px-4 py-3 border-b border-white/10">
              <h2 className="text-sm font-display uppercase tracking-wider">Revise session</h2>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <label className="block text-xs">
                <span className={muted}>Title</span>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className={`mt-1 w-full px-3 py-2 rounded-lg border text-sm ${
                    isDark ? 'bg-gray-900 border-white/15 text-white' : 'bg-white border-gray-300'
                  }`}
                />
              </label>
              <label className="block text-xs">
                <span className={muted}>Case summary</span>
                <textarea
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  rows={3}
                  className={`mt-1 w-full px-3 py-2 rounded-lg border text-sm resize-none ${
                    isDark ? 'bg-gray-900 border-white/15 text-white' : 'bg-white border-gray-300'
                  }`}
                />
              </label>
              <label className="block text-xs">
                <span className={muted}>Officer notes</span>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                  className={`mt-1 w-full px-3 py-2 rounded-lg border text-sm resize-none ${
                    isDark ? 'bg-gray-900 border-white/15 text-white' : 'bg-white border-gray-300'
                  }`}
                />
              </label>
            </div>
            <div className="p-3 border-t border-white/10 space-y-2">
              <button
                type="button"
                onClick={() => void saveMeta()}
                disabled={loading}
                className="w-full py-2.5 rounded-xl bg-serpico-blue text-white text-sm font-semibold disabled:opacity-50"
              >
                Save revisions
              </button>
              <button
                type="button"
                onClick={() => void deleteActive()}
                className={`w-full py-2 rounded-xl text-sm border ${
                  isDark ? 'border-red-500/40 text-red-300' : 'border-red-200 text-red-700'
                }`}
              >
                Delete session
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InvestigationHelper;
