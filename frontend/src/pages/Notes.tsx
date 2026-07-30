import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import {
  InvestigationCase,
  InvestigationNode,
  investigationAPI,
} from '../services/api';

type NodeForm = {
  place: string;
  location: string;
  name: string;
  time: string;
  event: string;
  analysis: string;
};

const emptyNodeForm = (): NodeForm => ({
  place: '',
  location: '',
  name: '',
  time: new Date().toISOString().slice(0, 16),
  event: '',
  analysis: '',
});

function toLocalInput(iso: string): string {
  if (!iso) return '';
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(iso)) return iso.slice(0, 16);
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 16);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDisplayTime(iso: string): string {
  if (!iso) return 'No time';
  const normalized = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(iso) ? `${iso}:00` : iso;
  const d = new Date(normalized);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function apiErrorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'response' in err) {
    const data = (err as { response?: { data?: { error?: string } } }).response?.data;
    if (data?.error) return data.error;
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

/** Cases list — expand a case to work its timed notes in-pane. */
const Notes: React.FC = () => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const { caseId: routeCaseId } = useParams<{ caseId?: string }>();
  const isDark = theme === 'dark';

  const [cases, setCases] = useState<InvestigationCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCaseForm, setShowCaseForm] = useState(false);
  const [savingCase, setSavingCase] = useState(false);
  const [caseForm, setCaseForm] = useState({
    type: '',
    location: '',
    date: new Date().toISOString().slice(0, 10),
    description: '',
  });

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [nodesByCase, setNodesByCase] = useState<Record<string, InvestigationNode[]>>({});
  const [loadingNodes, setLoadingNodes] = useState(false);

  const [showNoteForm, setShowNoteForm] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteForm, setNoteForm] = useState<NodeForm>(emptyNodeForm);
  const [savingNote, setSavingNote] = useState(false);
  const [assisting, setAssisting] = useState(false);

  const loadCases = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { cases: list } = await investigationAPI.listCases();
      setCases(list || []);
    } catch (err) {
      console.error(err);
      setError(apiErrorMessage(err, 'Unable to load cases. Check backend connection.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCases();
  }, [loadCases]);

  const loadNodesForCase = useCallback(async (caseId: string) => {
    setLoadingNodes(true);
    setError('');
    try {
      const data = await investigationAPI.getCase(caseId);
      setNodesByCase((prev) => ({ ...prev, [caseId]: data.nodes || [] }));
      if (data.case) {
        setCases((prev) =>
          prev.map((c) =>
            c.id === caseId ? { ...c, ...data.case, nodeCount: data.nodes?.length ?? 0 } : c
          )
        );
      }
    } catch (err) {
      console.error(err);
      setError(apiErrorMessage(err, 'Unable to load case notes.'));
    } finally {
      setLoadingNodes(false);
    }
  }, []);

  // Deep-link /notes/:caseId → expand that case once cases are loaded.
  useEffect(() => {
    if (!routeCaseId || loading || !cases.some((c) => c.id === routeCaseId)) return;
    if (expandedId === routeCaseId) return;
    setExpandedId(routeCaseId);
    void loadNodesForCase(routeCaseId);
  }, [routeCaseId, loading, cases, expandedId, loadNodesForCase]);

  const toggleCase = async (caseId: string) => {
    if (expandedId === caseId) {
      setExpandedId(null);
      setShowNoteForm(false);
      setEditingNoteId(null);
      if (routeCaseId) navigate('/notes', { replace: true });
      return;
    }
    setExpandedId(caseId);
    setShowNoteForm(false);
    setEditingNoteId(null);
    setNoteForm(emptyNodeForm());
    navigate(`/notes/${caseId}`, { replace: true });
    await loadNodesForCase(caseId);
  };

  const createCase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!caseForm.type.trim()) {
      setError('Case title is required.');
      return;
    }
    setSavingCase(true);
    setError('');
    try {
      const created = await investigationAPI.createCase({
        type: caseForm.type.trim(),
        location: caseForm.location.trim() || 'TBD',
        date: caseForm.date || new Date().toISOString().slice(0, 10),
        description: caseForm.description.trim(),
      });
      setShowCaseForm(false);
      setCaseForm({
        type: '',
        location: '',
        date: new Date().toISOString().slice(0, 10),
        description: '',
      });
      const withCount = { ...created, nodeCount: 0 };
      setCases((prev) => [withCount, ...prev]);
      setExpandedId(created.id);
      setNodesByCase((prev) => ({ ...prev, [created.id]: [] }));
      setShowNoteForm(true);
      setEditingNoteId(null);
      setNoteForm(emptyNodeForm());
      navigate(`/notes/${created.id}`, { replace: true });
    } catch (err) {
      console.error(err);
      setError(apiErrorMessage(err, 'Could not create case.'));
    } finally {
      setSavingCase(false);
    }
  };

  const openAddNote = () => {
    setEditingNoteId(null);
    setNoteForm(emptyNodeForm());
    setShowNoteForm(true);
  };

  const openEditNote = (node: InvestigationNode) => {
    setEditingNoteId(node.id);
    setNoteForm({
      place: node.place || '',
      location: node.location || '',
      name: node.name || '',
      time: toLocalInput(node.time),
      event: node.event || '',
      analysis: node.analysis || '',
    });
    setShowNoteForm(true);
  };

  const cancelNoteForm = () => {
    setShowNoteForm(false);
    setEditingNoteId(null);
    setNoteForm(emptyNodeForm());
  };

  const saveNote = async () => {
    if (!expandedId || !noteForm.event.trim()) {
      setError('Event description is required.');
      return;
    }
    setSavingNote(true);
    setError('');
    try {
      const payload = {
        place: noteForm.place.trim(),
        location: noteForm.location.trim(),
        name: noteForm.name.trim(),
        time: noteForm.time || new Date().toISOString().slice(0, 16),
        event: noteForm.event.trim(),
        analysis: noteForm.analysis.trim(),
      };
      if (editingNoteId) {
        await investigationAPI.updateNode(editingNoteId, payload);
      } else {
        await investigationAPI.createNode(expandedId, {
          ...payload,
          authorName: user?.name || 'Officer',
        });
      }
      cancelNoteForm();
      await loadNodesForCase(expandedId);
      await loadCases();
    } catch (err) {
      console.error(err);
      setError(apiErrorMessage(err, 'Failed to save note.'));
    } finally {
      setSavingNote(false);
    }
  };

  const removeNote = async (id: string) => {
    if (!expandedId || !window.confirm('Delete this note?')) return;
    setError('');
    try {
      await investigationAPI.deleteNode(id);
      await loadNodesForCase(expandedId);
      await loadCases();
    } catch (err) {
      setError(apiErrorMessage(err, 'Failed to delete note.'));
    }
  };

  const assistWithAI = async () => {
    if (!expandedId) return;
    setAssisting(true);
    setError('');
    try {
      const result = await investigationAPI.assistNode(expandedId, {
        place: noteForm.place,
        location: noteForm.location,
        name: noteForm.name,
        time: noteForm.time,
        event: noteForm.event,
        analysis: noteForm.analysis,
      });
      setNoteForm((prev) => ({
        ...prev,
        event: result.event || prev.event,
        analysis: result.analysis || prev.analysis,
      }));
    } catch (err) {
      setError(apiErrorMessage(err, 'AI assist failed.'));
    } finally {
      setAssisting(false);
    }
  };

  return (
    <div className="page-fill">
      <div className="game-header p-2 sm:p-3 flex-shrink-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] font-display uppercase tracking-[0.2em] text-serpico-blue/80">
              Investigation desk
            </p>
            <h1 className="text-xl sm:text-2xl font-display font-bold text-serpico-red tracking-wide">
              Cases
            </h1>
            <p className="text-[11px] sm:text-xs text-synth-muted mt-0.5">
              Expand a case to view and add timed notes.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowCaseForm((v) => !v)}
            className="flex-shrink-0 px-2.5 py-1.5 rounded-md text-[10px] font-display uppercase tracking-wider border border-neon-cyan/40 text-neon-cyan hover:bg-neon-cyan/15"
          >
            {showCaseForm ? 'Cancel' : 'New case'}
          </button>
        </div>
      </div>

      <div className="scroll-area p-2 sm:p-3 space-y-3">
        {error && (
          <div className="rounded-lg border border-serpico-red/40 bg-serpico-red/10 px-3 py-2 text-xs text-serpico-red">
            {error}
          </div>
        )}

        {showCaseForm && (
          <form onSubmit={createCase} className="game-panel p-3 space-y-2 border border-neon-cyan/30">
            <p className="text-[10px] font-display uppercase tracking-wider text-neon-cyan">New case</p>
            <input
              value={caseForm.type}
              onChange={(e) => setCaseForm((f) => ({ ...f, type: e.target.value }))}
              placeholder="Case title (e.g. Armed robbery — 5th & Main)"
              className="w-full px-3 py-2 rounded-lg border border-white/10 bg-black/30 text-sm text-white"
              required
              autoFocus
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                value={caseForm.location}
                onChange={(e) => setCaseForm((f) => ({ ...f, location: e.target.value }))}
                placeholder="Primary location (optional)"
                className="px-3 py-2 rounded-lg border border-white/10 bg-black/30 text-sm text-white"
              />
              <input
                type="date"
                value={caseForm.date}
                onChange={(e) => setCaseForm((f) => ({ ...f, date: e.target.value }))}
                className="px-3 py-2 rounded-lg border border-white/10 bg-black/30 text-sm text-white"
              />
            </div>
            <textarea
              value={caseForm.description}
              onChange={(e) => setCaseForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Case summary (optional)"
              rows={2}
              className="w-full px-3 py-2 rounded-lg border border-white/10 bg-black/30 text-sm text-white resize-y"
            />
            <button
              type="submit"
              disabled={savingCase || !caseForm.type.trim()}
              className="w-full py-2 rounded-lg bg-serpico-blue/80 text-white text-xs font-display uppercase tracking-wider hover:bg-serpico-blue disabled:opacity-50"
            >
              {savingCase ? 'Creating…' : 'Create case'}
            </button>
          </form>
        )}

        {loading ? (
          <p className="text-center text-sm text-neon-cyan animate-pulse py-8">Loading cases…</p>
        ) : cases.length === 0 ? (
          <div className="game-panel p-6 text-center space-y-2">
            <p className="text-sm text-gray-300">No cases yet.</p>
            <p className="text-xs text-synth-muted">Create a case, then expand it to add timed notes.</p>
            {!showCaseForm && (
              <button
                type="button"
                onClick={() => setShowCaseForm(true)}
                className="mt-2 px-3 py-2 rounded-lg bg-serpico-blue/80 text-white text-xs font-display uppercase tracking-wider hover:bg-serpico-blue"
              >
                New case
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {cases.map((c) => {
              const open = expandedId === c.id;
              const nodes = nodesByCase[c.id] || [];
              return (
                <div
                  key={c.id}
                  className={`game-panel border transition-colors ${
                    open ? 'border-neon-cyan/50' : 'border-white/10'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => void toggleCase(c.id)}
                    className="w-full px-3 py-3 text-left hover:bg-white/5 transition-colors"
                    aria-expanded={open}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          <span className="text-[9px] font-display uppercase tracking-wider text-neon-amber">
                            {open ? '▾ Case' : '▸ Case'}
                          </span>
                          <span
                            className={`text-[9px] px-1.5 py-0.5 rounded ${
                              c.solved
                                ? 'bg-neon-green/20 text-neon-green'
                                : 'bg-neon-magenta/20 text-neon-magenta'
                            }`}
                          >
                            {c.status}
                          </span>
                        </div>
                        <p className="font-display font-semibold text-sm text-white truncate">{c.type}</p>
                        <p className="text-[11px] text-synth-muted truncate">
                          {c.date}
                          {c.location ? ` · ${c.location}` : ''}
                        </p>
                        {c.description ? (
                          <p className="text-[11px] text-gray-400 mt-1 line-clamp-2">{c.description}</p>
                        ) : null}
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <p className="text-lg font-display font-bold text-neon-cyan tabular-nums">
                          {c.nodeCount ?? nodes.length}
                        </p>
                        <p className="text-[9px] uppercase text-synth-muted">notes</p>
                      </div>
                    </div>
                  </button>

                  {open && (
                    <div className="border-t border-white/10 px-3 py-3 space-y-3 bg-black/20">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[10px] font-display uppercase tracking-wider text-synth-muted">
                          Notes · ordered by time
                        </p>
                        <button
                          type="button"
                          onClick={openAddNote}
                          className="px-2.5 py-1 rounded-md text-[10px] font-display uppercase tracking-wider border border-neon-cyan/40 text-neon-cyan hover:bg-neon-cyan/15"
                        >
                          + Add note
                        </button>
                      </div>

                      {showNoteForm && (
                        <div className="rounded-lg border border-neon-cyan/30 bg-black/30 p-3 space-y-2">
                          <p className="text-[10px] font-display uppercase tracking-wider text-neon-cyan">
                            {editingNoteId ? 'Edit note' : 'New note'}
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <input
                              value={noteForm.place}
                              onChange={(e) => setNoteForm((p) => ({ ...p, place: e.target.value }))}
                              placeholder="Place"
                              className="px-3 py-2 rounded-lg border border-white/10 bg-black/30 text-sm text-white"
                            />
                            <input
                              value={noteForm.location}
                              onChange={(e) => setNoteForm((p) => ({ ...p, location: e.target.value }))}
                              placeholder="Location"
                              className="px-3 py-2 rounded-lg border border-white/10 bg-black/30 text-sm text-white"
                            />
                            <input
                              value={noteForm.name}
                              onChange={(e) => setNoteForm((p) => ({ ...p, name: e.target.value }))}
                              placeholder="Name"
                              className="px-3 py-2 rounded-lg border border-white/10 bg-black/30 text-sm text-white"
                            />
                            <input
                              type="datetime-local"
                              value={noteForm.time}
                              onChange={(e) => setNoteForm((p) => ({ ...p, time: e.target.value }))}
                              className="px-3 py-2 rounded-lg border border-white/10 bg-black/30 text-sm text-white"
                            />
                          </div>
                          <textarea
                            value={noteForm.event}
                            onChange={(e) => setNoteForm((p) => ({ ...p, event: e.target.value }))}
                            rows={3}
                            placeholder="Event — what happened"
                            className="w-full px-3 py-2 rounded-lg border border-white/10 bg-black/30 text-sm text-white resize-y"
                          />
                          <textarea
                            value={noteForm.analysis}
                            onChange={(e) => setNoteForm((p) => ({ ...p, analysis: e.target.value }))}
                            rows={2}
                            placeholder="Analysis (optional)"
                            className="w-full px-3 py-2 rounded-lg border border-white/10 bg-black/30 text-sm text-white resize-y"
                          />
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <button
                              type="button"
                              onClick={() => void assistWithAI()}
                              disabled={assisting || savingNote}
                              className="px-3 py-1.5 rounded-md text-[10px] font-display uppercase tracking-wider border border-neon-magenta/40 text-neon-magenta hover:bg-neon-magenta/15 disabled:opacity-50"
                            >
                              {assisting ? 'AI drafting…' : 'AI Assist'}
                            </button>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={cancelNoteForm}
                                disabled={savingNote}
                                className="px-3 py-1.5 rounded-md text-[10px] font-display uppercase border border-white/15 text-gray-300"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={() => void saveNote()}
                                disabled={savingNote || !noteForm.event.trim()}
                                className="px-3 py-1.5 rounded-md text-[10px] font-display uppercase bg-serpico-blue/80 text-white hover:bg-serpico-blue disabled:opacity-50"
                              >
                                {savingNote ? 'Saving…' : editingNoteId ? 'Save' : 'Add note'}
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {loadingNodes && !nodes.length ? (
                        <p className="text-center text-xs text-neon-cyan animate-pulse py-4">Loading notes…</p>
                      ) : nodes.length === 0 && !showNoteForm ? (
                        <div className="text-center py-4 space-y-2">
                          <p className="text-xs text-synth-muted">No notes on this case yet.</p>
                          <button
                            type="button"
                            onClick={openAddNote}
                            className="px-3 py-1.5 rounded-md text-[10px] font-display uppercase bg-serpico-blue/80 text-white"
                          >
                            Add first note
                          </button>
                        </div>
                      ) : (
                        <ol className="relative space-y-2 pl-3 border-l border-neon-cyan/25">
                          {nodes.map((node) => (
                            <li key={node.id} className="relative pl-2">
                              <span
                                className="absolute -left-[0.95rem] top-2.5 h-2 w-2 rounded-full bg-neon-cyan"
                                aria-hidden
                              />
                              <div className="rounded-md border border-white/10 bg-black/25 px-2.5 py-2 space-y-1.5">
                                <div className="flex items-start justify-between gap-2">
                                  <time className="text-[10px] font-display uppercase tracking-wider text-neon-amber">
                                    {formatDisplayTime(node.time)}
                                  </time>
                                  <div className="flex gap-1">
                                    <button
                                      type="button"
                                      onClick={() => openEditNote(node)}
                                      className="px-1.5 py-0.5 rounded text-[9px] font-display uppercase border border-white/15 text-gray-300"
                                    >
                                      Edit
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => void removeNote(node.id)}
                                      className="px-1.5 py-0.5 rounded text-[9px] font-display uppercase border border-serpico-red/40 text-serpico-red"
                                    >
                                      Del
                                    </button>
                                  </div>
                                </div>
                                <p className="text-sm text-white leading-snug">{node.event}</p>
                                <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-gray-400">
                                  {node.place ? <span>Place: {node.place}</span> : null}
                                  {node.location ? <span>Loc: {node.location}</span> : null}
                                  {node.name ? <span>Name: {node.name}</span> : null}
                                </div>
                                {node.analysis ? (
                                  <p className="text-[11px] text-gray-300 border-t border-white/10 pt-1.5 whitespace-pre-wrap">
                                    <span className="text-[9px] uppercase text-neon-magenta/80 mr-1">Analysis</span>
                                    {node.analysis}
                                  </p>
                                ) : null}
                              </div>
                            </li>
                          ))}
                        </ol>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <section className="game-panel p-3 space-y-2 border border-white/10">
          <p className="text-[10px] font-display uppercase tracking-wider text-synth-muted">Account</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={toggleTheme}
              className="px-3 py-1.5 rounded-md text-[10px] font-display uppercase border border-white/15 text-gray-300"
            >
              {isDark ? 'Dawn mode' : 'Night mode'}
            </button>
            <button
              type="button"
              onClick={() => {
                logout();
                navigate('/login');
              }}
              className="px-3 py-1.5 rounded-md text-[10px] font-display uppercase border border-serpico-red/40 text-serpico-red"
            >
              Logout
            </button>
            {user?.name && (
              <span className="text-[10px] text-synth-muted self-center ml-1">{user.name}</span>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default Notes;
