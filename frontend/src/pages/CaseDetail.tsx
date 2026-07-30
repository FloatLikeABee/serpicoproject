import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
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

const emptyForm = (): NodeForm => ({
  place: '',
  location: '',
  name: '',
  time: new Date().toISOString().slice(0, 16),
  event: '',
  analysis: '',
});

function toLocalInput(iso: string): string {
  if (!iso) return '';
  // Already datetime-local shaped
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

const CaseDetail: React.FC = () => {
  const { caseId } = useParams<{ caseId: string }>();
  const { user } = useAuth();

  const [caseRow, setCaseRow] = useState<InvestigationCase | null>(null);
  const [nodes, setNodes] = useState<InvestigationNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<NodeForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [assisting, setAssisting] = useState(false);

  const load = useCallback(async () => {
    if (!caseId) return;
    setLoading(true);
    setError('');
    try {
      const data = await investigationAPI.getCase(caseId);
      setCaseRow(data.case);
      setNodes(data.nodes || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load case');
      setCaseRow(null);
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm());
    setEditorOpen(true);
  };

  const openEdit = (node: InvestigationNode) => {
    setEditingId(node.id);
    setForm({
      place: node.place || '',
      location: node.location || '',
      name: node.name || '',
      time: toLocalInput(node.time),
      event: node.event || '',
      analysis: node.analysis || '',
    });
    setEditorOpen(true);
  };

  const closeEditor = () => {
    setEditorOpen(false);
    setEditingId(null);
    setForm(emptyForm());
  };

  const saveNode = async () => {
    if (!caseId || !form.event.trim()) {
      setError('Event description is required');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = {
        place: form.place.trim(),
        location: form.location.trim(),
        name: form.name.trim(),
        time: form.time || new Date().toISOString().slice(0, 16),
        event: form.event.trim(),
        analysis: form.analysis.trim(),
      };
      if (editingId) {
        await investigationAPI.updateNode(editingId, payload);
      } else {
        await investigationAPI.createNode(caseId, {
          ...payload,
          authorName: user?.name || 'Officer',
        });
      }
      closeEditor();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save node');
    } finally {
      setSaving(false);
    }
  };

  const removeNode = async (id: string) => {
    if (!window.confirm('Delete this event node?')) return;
    setError('');
    try {
      await investigationAPI.deleteNode(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete node');
    }
  };

  const assistWithAI = async () => {
    if (!caseId) return;
    setAssisting(true);
    setError('');
    try {
      const result = await investigationAPI.assistNode(caseId, {
        place: form.place,
        location: form.location,
        name: form.name,
        time: form.time,
        event: form.event,
        analysis: form.analysis,
      });
      setForm((prev) => ({
        ...prev,
        event: result.event || prev.event,
        analysis: result.analysis || prev.analysis,
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI assist failed');
    } finally {
      setAssisting(false);
    }
  };

  if (loading) {
    return (
      <div className="page-fill">
        <p className="text-center text-sm text-neon-cyan animate-pulse py-16">Loading case…</p>
      </div>
    );
  }

  if (!caseRow) {
    return (
      <div className="page-fill p-3 space-y-3">
        <div className="rounded-lg border border-serpico-red/40 bg-serpico-red/10 px-3 py-2 text-xs text-serpico-red">
          {error || 'Case not found'}
        </div>
        <Link
          to="/notes"
          className="inline-block px-3 py-1.5 rounded-md text-[10px] font-display uppercase tracking-wider border border-white/15 text-gray-300"
        >
          ← Back to cases
        </Link>
      </div>
    );
  }

  return (
    <div className="page-fill">
      <div className="game-header p-2 sm:p-3 flex-shrink-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <Link
              to="/notes"
              className="text-[10px] font-display uppercase tracking-[0.2em] text-serpico-blue/80 hover:text-neon-cyan"
            >
              ← Cases
            </Link>
            <h1 className="text-xl sm:text-2xl font-display font-bold text-serpico-red tracking-wide mt-0.5 truncate">
              {caseRow.type}
            </h1>
            <p className="text-[11px] sm:text-xs text-synth-muted mt-0.5">
              {caseRow.date} · {caseRow.location}
              {caseRow.description ? ` · ${caseRow.description}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={openCreate}
            className="flex-shrink-0 px-2.5 py-1.5 rounded-md text-[10px] font-display uppercase tracking-wider border border-neon-cyan/40 text-neon-cyan hover:bg-neon-cyan/15"
          >
            + Add node
          </button>
        </div>
      </div>

      <div className="scroll-area p-2 sm:p-3 space-y-3">
        {error && (
          <div className="rounded-lg border border-serpico-red/40 bg-serpico-red/10 px-3 py-2 text-xs text-serpico-red">
            {error}
          </div>
        )}

        <div className="flex items-center justify-between text-[10px] font-display uppercase tracking-wider text-synth-muted px-0.5">
          <span>
            {nodes.length} event{nodes.length === 1 ? '' : 's'}
          </span>
          <span>Ordered by time</span>
        </div>

        {nodes.length === 0 ? (
          <div className="game-panel p-6 text-center space-y-3">
            <p className="text-sm text-gray-300">No nodes yet.</p>
            <p className="text-xs text-synth-muted">
              Add timed events with place, location, name, time, event, and analysis.
            </p>
            <button
              type="button"
              onClick={openCreate}
              className="px-3 py-2 rounded-lg bg-serpico-blue/80 text-white text-xs font-display uppercase tracking-wider hover:bg-serpico-blue"
            >
              Add first node
            </button>
          </div>
        ) : (
          <ol className="relative space-y-3 pl-4 border-l border-neon-cyan/25">
            {nodes.map((node) => (
              <li key={node.id} className="relative">
                <span
                  className="absolute -left-[1.35rem] top-3 h-2.5 w-2.5 rounded-full bg-neon-cyan shadow-[0_0_8px_rgba(34,211,238,0.6)]"
                  aria-hidden
                />
                <article className="game-panel border border-white/10 px-3 py-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <time className="text-[10px] font-display uppercase tracking-wider text-neon-amber">
                      {formatDisplayTime(node.time)}
                    </time>
                    <div className="flex gap-1.5 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => openEdit(node)}
                        className="px-2 py-1 rounded text-[9px] font-display uppercase border border-white/15 text-gray-300 hover:border-neon-cyan/40"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => void removeNode(node.id)}
                        className="px-2 py-1 rounded text-[9px] font-display uppercase border border-serpico-red/40 text-serpico-red"
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  <h3 className="text-sm font-semibold text-white leading-snug">{node.event}</h3>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
                    {node.place ? (
                      <div>
                        <p className="text-[9px] uppercase text-synth-muted">Place</p>
                        <p className="text-gray-200">{node.place}</p>
                      </div>
                    ) : null}
                    {node.location ? (
                      <div>
                        <p className="text-[9px] uppercase text-synth-muted">Location</p>
                        <p className="text-gray-200">{node.location}</p>
                      </div>
                    ) : null}
                    {node.name ? (
                      <div>
                        <p className="text-[9px] uppercase text-synth-muted">Name</p>
                        <p className="text-gray-200">{node.name}</p>
                      </div>
                    ) : null}
                  </div>

                  {node.analysis ? (
                    <div className="pt-1 border-t border-white/10">
                      <p className="text-[9px] uppercase text-neon-magenta/80 mb-0.5">Analysis</p>
                      <p className="text-[11px] text-gray-300 whitespace-pre-wrap">{node.analysis}</p>
                    </div>
                  ) : null}
                </article>
              </li>
            ))}
          </ol>
        )}
      </div>

      {editorOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-0 sm:p-4"
          role="presentation"
          onClick={closeEditor}
        >
          <div
            className="w-full sm:max-w-lg max-h-[92vh] overflow-y-auto game-panel border border-neon-cyan/30 rounded-t-xl sm:rounded-xl p-4 space-y-3"
            role="dialog"
            aria-modal="true"
            aria-labelledby="node-editor-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <h2 id="node-editor-title" className="text-lg font-display font-bold text-white">
                {editingId ? 'Edit node' : 'Add node'}
              </h2>
              <p className="text-[11px] text-synth-muted mt-0.5">
                Fill what you know. Use AI Assist to draft event and analysis.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <label className="block space-y-1">
                <span className="text-[9px] font-display uppercase tracking-wider text-synth-muted">Place</span>
                <input
                  value={form.place}
                  onChange={(e) => setForm((p) => ({ ...p, place: e.target.value }))}
                  placeholder="Venue / site"
                  className="w-full px-3 py-2 rounded-lg border border-white/10 bg-black/30 text-sm text-white"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-[9px] font-display uppercase tracking-wider text-synth-muted">Location</span>
                <input
                  value={form.location}
                  onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))}
                  placeholder="Address or area"
                  className="w-full px-3 py-2 rounded-lg border border-white/10 bg-black/30 text-sm text-white"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-[9px] font-display uppercase tracking-wider text-synth-muted">Name</span>
                <input
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Person involved"
                  className="w-full px-3 py-2 rounded-lg border border-white/10 bg-black/30 text-sm text-white"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-[9px] font-display uppercase tracking-wider text-synth-muted">Time</span>
                <input
                  type="datetime-local"
                  value={form.time}
                  onChange={(e) => setForm((p) => ({ ...p, time: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-white/10 bg-black/30 text-sm text-white"
                />
              </label>
            </div>

            <label className="block space-y-1">
              <span className="text-[9px] font-display uppercase tracking-wider text-synth-muted">Event</span>
              <textarea
                value={form.event}
                onChange={(e) => setForm((p) => ({ ...p, event: e.target.value }))}
                rows={4}
                placeholder="What happened"
                className="w-full px-3 py-2 rounded-lg border border-white/10 bg-black/30 text-sm text-white resize-y"
              />
            </label>

            <label className="block space-y-1">
              <span className="text-[9px] font-display uppercase tracking-wider text-synth-muted">Analysis</span>
              <textarea
                value={form.analysis}
                onChange={(e) => setForm((p) => ({ ...p, analysis: e.target.value }))}
                rows={3}
                placeholder="Investigative significance"
                className="w-full px-3 py-2 rounded-lg border border-white/10 bg-black/30 text-sm text-white resize-y"
              />
            </label>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <button
                type="button"
                onClick={() => void assistWithAI()}
                disabled={assisting || saving}
                className="px-3 py-1.5 rounded-md text-[10px] font-display uppercase tracking-wider border border-neon-magenta/40 text-neon-magenta hover:bg-neon-magenta/15 disabled:opacity-50"
              >
                {assisting ? 'AI drafting…' : 'AI Assist'}
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={closeEditor}
                  disabled={saving}
                  className="px-3 py-1.5 rounded-md text-[10px] font-display uppercase border border-white/15 text-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void saveNode()}
                  disabled={saving || !form.event.trim()}
                  className="px-3 py-1.5 rounded-md text-[10px] font-display uppercase bg-serpico-blue/80 text-white hover:bg-serpico-blue disabled:opacity-50"
                >
                  {saving ? 'Saving…' : editingId ? 'Save' : 'Add node'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default CaseDetail;
