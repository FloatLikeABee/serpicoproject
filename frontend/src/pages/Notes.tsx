import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ChatMarkdown from '../components/ChatMarkdown';
import { useAuth } from '../contexts/AuthContext';
import { useT } from '../i18n/useT';
import {
  InvestigationCase,
  InvestigationNode,
  investigationAPI,
} from '../services/api';
import {
  loadCachedCases,
  loadCachedNodes,
  saveCachedCases,
  saveCachedNodes,
  upsertCachedCase,
} from '../utils/investigationStore';
import { applyNationToOfficerFields } from '../utils/officerContent';
import CasesAccountButton from '../components/CasesAccountButton';

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

/** Unwrap AI JSON blobs into readable prose for display / form fields. */
function displayNoteText(value: string): string {
  const raw = (value || '').trim();
  if (!raw) return '';

  const tryParse = (s: string): unknown => {
    try {
      return JSON.parse(s);
    } catch {
      return null;
    }
  };

  const flatten = (v: unknown): string => {
    if (v == null) return '';
    if (typeof v === 'string') {
      const inner = v.trim();
      if (
        (inner.startsWith('{') && inner.endsWith('}')) ||
        (inner.startsWith('[') && inner.endsWith(']'))
      ) {
        const nested = tryParse(inner);
        if (nested != null) return flatten(nested);
      }
      return inner;
    }
    if (typeof v === 'number' || typeof v === 'boolean') return String(v);
    if (Array.isArray(v)) return v.map(flatten).filter(Boolean).join('; ');
    if (typeof v === 'object') {
      const obj = v as Record<string, unknown>;
      // Full assist payload accidentally stored in analysis
      if ('event' in obj || 'analysis' in obj) {
        const analysis = obj.analysis != null ? flatten(obj.analysis) : '';
        const event = obj.event != null ? flatten(obj.event) : '';
        if (analysis) return analysis;
        if (event) return event;
      }
      const preferred = ['summary', 'text', 'notes', 'analysis', 'leads', 'gaps', 'next', 'nextChecks', 'next_checks'];
      const parts: string[] = [];
      const seen = new Set<string>();
      for (const key of preferred) {
        if (key in obj) {
          seen.add(key);
          parts.push(`${key.replace(/_/g, ' ')}: ${flatten(obj[key])}`);
        }
      }
      for (const [k, val] of Object.entries(obj)) {
        if (seen.has(k)) continue;
        parts.push(`${k.replace(/_/g, ' ')}: ${flatten(val)}`);
      }
      return parts.join('. ');
    }
    return String(v);
  };

  let candidate = raw;
  if (candidate.startsWith('```')) {
    candidate = candidate.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  }
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start >= 0 && end > start) {
    const sliced = candidate.slice(start, end + 1);
    const parsed = tryParse(sliced);
    if (parsed != null) return flatten(parsed);
  }
  if (candidate.startsWith('[') && candidate.endsWith(']')) {
    const parsed = tryParse(candidate);
    if (parsed != null) return flatten(parsed);
  }
  return raw;
}

function apiErrorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'response' in err) {
    const data = (err as { response?: { data?: { error?: string } } }).response?.data;
    if (data?.error) return data.error;
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

/** Collapsible markdown block so saved notes don't dominate the case pane. */
function CompactNoteMarkdown({
  content,
  label,
  maxCollapsedLines = 5,
}: {
  content: string;
  label?: string;
  maxCollapsedLines?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const text = displayNoteText(content);
  if (!text) return null;
  const long = text.length > 320 || text.split('\n').length > maxCollapsedLines;

  return (
    <div>
      {label ? (
        <p className="text-[9px] uppercase text-neon-magenta/80 mb-1">{label}</p>
      ) : null}
      <div
        className={
          long && !expanded
            ? 'max-h-28 overflow-hidden relative'
            : 'max-h-52 overflow-y-auto overscroll-contain'
        }
      >
        <ChatMarkdown content={text} size="xs" />
        {long && !expanded ? (
          <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-[#061428] to-transparent pointer-events-none" />
        ) : null}
      </div>
      {long ? (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 text-[9px] font-display uppercase tracking-wider text-neon-cyan/90 hover:text-neon-cyan"
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      ) : null}
    </div>
  );
}

/** Cases list — expand a case to work its timed notes in-pane. */
const Notes: React.FC = () => {
  const { user } = useAuth();
  const t = useT();
  const navigate = useNavigate();
  const { caseId: routeCaseId } = useParams<{ caseId?: string }>();

  const [cases, setCases] = useState<InvestigationCase[]>(() => loadCachedCases());
  const [loading, setLoading] = useState(() => loadCachedCases().length === 0);
  const [syncing, setSyncing] = useState(false);
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
  const rehydrateRef = useRef(false);

  const [showNoteForm, setShowNoteForm] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteForm, setNoteForm] = useState<NodeForm>(emptyNodeForm);
  const [savingNote, setSavingNote] = useState(false);
  const [assisting, setAssisting] = useState(false);

  /** Push browser-cached cases/notes back to API after an ephemeral DB wipe. */
  const rehydrateServerFromCache = useCallback(async (cached: InvestigationCase[]) => {
    if (rehydrateRef.current || cached.length === 0) return;
    rehydrateRef.current = true;
    const restored: InvestigationCase[] = [];
    try {
      for (const c of cached) {
        const created = await investigationAPI.createCase({
          type: c.type,
          location: c.location || 'TBD',
          date: c.date || new Date().toISOString().slice(0, 10),
          description: c.description || '',
        });
        const oldNodes = loadCachedNodes(c.id);
        const newNodes: InvestigationNode[] = [];
        for (const n of oldNodes) {
          const { node } = await investigationAPI.createNode(created.id, {
            authorName: n.authorName || user?.name || 'Officer',
            place: n.place || '',
            location: n.location || '',
            name: n.name || '',
            time: n.time || new Date().toISOString().slice(0, 16),
            event: n.event,
            analysis: n.analysis || '',
          });
          newNodes.push(node);
        }
        saveCachedNodes(created.id, newNodes);
        restored.push({ ...created, nodeCount: newNodes.length });
      }
      saveCachedCases(restored);
      setCases(restored);
      setNodesByCase((prev) => {
        const next = { ...prev };
        for (const c of restored) {
          next[c.id] = loadCachedNodes(c.id);
        }
        return next;
      });
    } catch (err) {
      console.warn('Failed to rehydrate cases to server', err);
    }
  }, [user?.name]);

  const loadCases = useCallback(async () => {
    const cached = loadCachedCases();
    if (cached.length > 0) {
      setCases(cached);
      setLoading(false);
    } else {
      setLoading(true);
    }

    setSyncing(true);
    setError('');
    try {
      const { cases: list } = await investigationAPI.listCases();
      const remote = list || [];
      if (remote.length > 0) {
        const byId = new Map<string, InvestigationCase>();
        for (const c of remote) byId.set(c.id, c);
        // Keep any device-only drafts the server does not know about yet.
        for (const c of cached) {
          if (c.id.startsWith('local-') && !byId.has(c.id)) byId.set(c.id, c);
        }
        const merged = Array.from(byId.values());
        setCases(merged);
        saveCachedCases(merged);
      } else if (cached.length > 0) {
        // Server empty (likely redeploy wiped SQLite) — keep cache and restore.
        setCases(cached);
        void rehydrateServerFromCache(cached);
      } else {
        setCases([]);
        saveCachedCases([]);
      }
    } catch (err) {
      console.error(err);
      if (cached.length === 0) {
        setError(apiErrorMessage(err, 'Unable to load cases. Check backend connection.'));
      }
      // Keep showing cache if API is cold/down.
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  }, [rehydrateServerFromCache]);

  useEffect(() => {
    void loadCases();
  }, [loadCases]);

  const loadNodesForCase = useCallback(async (caseId: string) => {
    const cachedNodes = loadCachedNodes(caseId);
    if (cachedNodes.length > 0) {
      setNodesByCase((prev) => ({ ...prev, [caseId]: cachedNodes }));
      setLoadingNodes(false);
    } else {
      setLoadingNodes(true);
    }
    setError('');
    try {
      const data = await investigationAPI.getCase(caseId);
      const nodes = data.nodes || [];
      setNodesByCase((prev) => ({ ...prev, [caseId]: nodes }));
      saveCachedNodes(caseId, nodes);
      if (data.case) {
        setCases((prev) => {
          const next = prev.map((c) =>
            c.id === caseId ? { ...c, ...data.case, nodeCount: nodes.length } : c
          );
          saveCachedCases(next);
          return next;
        });
      }
    } catch (err) {
      console.error(err);
      if (cachedNodes.length === 0) {
        // Case may only exist in cache after a wipe — show cache, no hard error.
        const stillCached = loadCachedNodes(caseId);
        if (stillCached.length > 0) {
          setNodesByCase((prev) => ({ ...prev, [caseId]: stillCached }));
        } else {
          setError(apiErrorMessage(err, 'Unable to load case notes.'));
        }
      }
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
    const draft = {
      type: caseForm.type.trim(),
      location: caseForm.location.trim() || 'TBD',
      date: caseForm.date || new Date().toISOString().slice(0, 10),
      description: caseForm.description.trim(),
    };
    try {
      let created: InvestigationCase;
      try {
        created = await investigationAPI.createCase(draft);
      } catch (apiErr) {
        // Offline / cold backend — keep the case in the browser so refresh still shows it.
        created = {
          id: `local-${Date.now()}`,
          type: draft.type,
          location: draft.location,
          date: draft.date,
          status: 'Open',
          description: draft.description,
          solved: false,
          nodeCount: 0,
        };
        console.warn('createCase API failed; saved locally', apiErr);
        setError('Saved on this device — server unreachable. Will sync when backend is up.');
      }
      setShowCaseForm(false);
      setCaseForm({
        type: '',
        location: '',
        date: new Date().toISOString().slice(0, 10),
        description: '',
      });
      const withCount = { ...created, nodeCount: created.nodeCount ?? 0 };
      upsertCachedCase(withCount);
      saveCachedNodes(created.id, []);
      setCases((prev) => {
        const next = [withCount, ...prev.filter((c) => c.id !== withCount.id)];
        saveCachedCases(next);
        return next;
      });
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
      event: displayNoteText(node.event || ''),
      analysis: displayNoteText(node.analysis || ''),
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
      const payload = applyNationToOfficerFields(
        {
          place: noteForm.place.trim(),
          location: noteForm.location.trim(),
          name: noteForm.name.trim(),
          time: noteForm.time || new Date().toISOString().slice(0, 16),
          event: displayNoteText(noteForm.event.trim()),
          analysis: displayNoteText(noteForm.analysis.trim()),
        },
        user?.nation || 'us'
      );

      let nextNodes = [...(nodesByCase[expandedId] || loadCachedNodes(expandedId))];
      const isLocalCase = expandedId.startsWith('local-');

      if (editingNoteId) {
        try {
          if (!isLocalCase) {
            const { node } = await investigationAPI.updateNode(editingNoteId, payload);
            nextNodes = nextNodes.map((n) => (n.id === editingNoteId ? node : n));
          } else {
            nextNodes = nextNodes.map((n) =>
              n.id === editingNoteId
                ? { ...n, ...payload, updatedAt: new Date().toISOString() }
                : n
            );
          }
        } catch {
          nextNodes = nextNodes.map((n) =>
            n.id === editingNoteId
              ? { ...n, ...payload, updatedAt: new Date().toISOString() }
              : n
          );
          setError('Note saved on this device — server sync pending.');
        }
      } else {
        try {
          if (!isLocalCase) {
            const { node } = await investigationAPI.createNode(expandedId, {
              ...payload,
              authorName: user?.name || 'Officer',
            });
            nextNodes = [...nextNodes, node].sort((a, b) => a.time.localeCompare(b.time));
          } else {
            throw new Error('local-only case');
          }
        } catch {
          const localNode: InvestigationNode = {
            id: `local-node-${Date.now()}`,
            caseId: expandedId,
            authorName: user?.name || 'Officer',
            place: payload.place,
            location: payload.location,
            name: payload.name,
            time: payload.time,
            event: payload.event,
            analysis: payload.analysis,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          nextNodes = [...nextNodes, localNode].sort((a, b) => a.time.localeCompare(b.time));
          setError('Note saved on this device — server sync pending.');
        }
      }

      setNodesByCase((prev) => ({ ...prev, [expandedId]: nextNodes }));
      saveCachedNodes(expandedId, nextNodes);
      setCases((prev) => {
        const next = prev.map((c) =>
          c.id === expandedId ? { ...c, nodeCount: nextNodes.length } : c
        );
        saveCachedCases(next);
        return next;
      });
      cancelNoteForm();
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
      try {
        if (!expandedId.startsWith('local-') && !id.startsWith('local-node-')) {
          await investigationAPI.deleteNode(id);
        }
      } catch (err) {
        console.warn('deleteNode API failed; removing locally', err);
      }
      const nextNodes = (nodesByCase[expandedId] || loadCachedNodes(expandedId)).filter(
        (n) => n.id !== id
      );
      setNodesByCase((prev) => ({ ...prev, [expandedId]: nextNodes }));
      saveCachedNodes(expandedId, nextNodes);
      setCases((prev) => {
        const next = prev.map((c) =>
          c.id === expandedId ? { ...c, nodeCount: nextNodes.length } : c
        );
        saveCachedCases(next);
        return next;
      });
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
        event: displayNoteText(result.event || prev.event),
        analysis: displayNoteText(result.analysis || prev.analysis),
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
              {t('cases.title')}
            </h1>
            <p className="text-[11px] sm:text-xs text-synth-muted mt-0.5">
              {t('cases.subtitle')}
              {syncing ? ' · Syncing…' : ''}
            </p>
          </div>
          <div className="flex-shrink-0 flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setShowCaseForm((v) => !v)}
              className="px-2.5 py-1.5 rounded-md text-[10px] font-display uppercase tracking-wider border border-neon-cyan/40 text-neon-cyan hover:bg-neon-cyan/15"
            >
              {showCaseForm ? t('cases.cancel') : t('cases.new')}
            </button>
            <CasesAccountButton />
          </div>
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
              {savingCase ? t('cases.creating') : t('cases.create')}
            </button>
          </form>
        )}

        {loading ? (
          <p className="text-center text-sm text-neon-cyan animate-pulse py-8">{t('cases.loading')}</p>
        ) : cases.length === 0 ? (
          <div className="game-panel p-6 text-center space-y-2">
            <p className="text-sm text-gray-300">{t('cases.empty')}</p>
            <p className="text-xs text-synth-muted">{t('cases.emptyHint')}</p>
            {!showCaseForm && (
              <button
                type="button"
                onClick={() => setShowCaseForm(true)}
                className="mt-2 px-3 py-2 rounded-lg bg-serpico-blue/80 text-white text-xs font-display uppercase tracking-wider hover:bg-serpico-blue"
              >
                {t('cases.new')}
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
                                <CompactNoteMarkdown content={node.event} />
                                <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-gray-400">
                                  {node.place ? <span>Place: {node.place}</span> : null}
                                  {node.location ? <span>Loc: {node.location}</span> : null}
                                  {node.name ? <span>Name: {node.name}</span> : null}
                                </div>
                                {node.analysis ? (
                                  <div className="text-[11px] text-gray-300 border-t border-white/10 pt-1.5">
                                    <CompactNoteMarkdown content={node.analysis} label="Analysis" />
                                  </div>
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
      </div>
    </div>
  );
};

export default Notes;
