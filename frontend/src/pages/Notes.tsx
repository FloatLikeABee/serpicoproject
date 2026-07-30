import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import {
  InvestigationCase,
  InvestigationNote,
  investigationAPI,
} from '../services/api';

const Notes: React.FC = () => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const isDark = theme === 'dark';

  const [cases, setCases] = useState<InvestigationCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [editingNote, setEditingNote] = useState<InvestigationNote | null>(null);
  const [saving, setSaving] = useState(false);

  const [noteForm, setNoteForm] = useState({ title: '', body: '' });
  const [showCaseForm, setShowCaseForm] = useState(false);
  const [caseForm, setCaseForm] = useState({
    type: '',
    location: '',
    date: new Date().toISOString().slice(0, 10),
    description: '',
  });

  const loadTree = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { cases: tree } = await investigationAPI.getTree();
      setCases(tree || []);
      setExpanded((prev) => {
        const next = { ...prev };
        for (const c of tree || []) {
          if (next[c.id] === undefined) next[c.id] = true;
        }
        return next;
      });
    } catch (err) {
      console.error(err);
      setError('Unable to load investigation notes. Check backend connection.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTree();
  }, [loadTree]);

  const toggleCase = (id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
    setSelectedCaseId(id);
  };

  const startNewNote = (caseId: string) => {
    setSelectedCaseId(caseId);
    setExpanded((prev) => ({ ...prev, [caseId]: true }));
    setEditingNote(null);
    setNoteForm({ title: '', body: '' });
  };

  const startEditNote = (note: InvestigationNote) => {
    setSelectedCaseId(note.caseId);
    setEditingNote(note);
    setNoteForm({ title: note.title, body: note.body });
  };

  const saveNote = async () => {
    if (!selectedCaseId || !noteForm.title.trim() || !noteForm.body.trim()) return;
    setSaving(true);
    setError('');
    try {
      if (editingNote) {
        await investigationAPI.updateNote(editingNote.id, {
          title: noteForm.title.trim(),
          body: noteForm.body.trim(),
        });
      } else {
        await investigationAPI.createNote(selectedCaseId, {
          authorName: user?.name || user?.rank || 'Officer',
          title: noteForm.title.trim(),
          body: noteForm.body.trim(),
        });
      }
      setNoteForm({ title: '', body: '' });
      setEditingNote(null);
      await loadTree();
    } catch (err) {
      console.error(err);
      setError('Could not save note. Notes must belong to a case.');
    } finally {
      setSaving(false);
    }
  };

  const removeNote = async (noteId: string) => {
    if (!window.confirm('Delete this investigation note?')) return;
    try {
      await investigationAPI.deleteNote(noteId);
      if (editingNote?.id === noteId) {
        setEditingNote(null);
        setNoteForm({ title: '', body: '' });
      }
      await loadTree();
    } catch (err) {
      console.error(err);
      setError('Could not delete note.');
    }
  };

  const createCase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!caseForm.type.trim() || !caseForm.location.trim()) return;
    setSaving(true);
    setError('');
    try {
      const created = await investigationAPI.createCase({
        type: caseForm.type.trim(),
        location: caseForm.location.trim(),
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
      await loadTree();
      setSelectedCaseId(created.id);
      setExpanded((prev) => ({ ...prev, [created.id]: true }));
    } catch (err) {
      console.error(err);
      setError('Could not create case.');
    } finally {
      setSaving(false);
    }
  };

  const selectedCase = cases.find((c) => c.id === selectedCaseId) || null;

  return (
    <div className="page-fill">
      <div className="game-header p-2 sm:p-3 flex-shrink-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] font-display uppercase tracking-[0.2em] text-serpico-blue/80">
              Investigation desk
            </p>
            <h1 className="text-xl sm:text-2xl font-display font-bold text-serpico-red tracking-wide">
              Notes
            </h1>
            <p className="text-[11px] sm:text-xs text-synth-muted mt-0.5">
              Case-linked notes for active investigations — every note sits under a case.
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
            <p className="text-[10px] font-display uppercase tracking-wider text-neon-cyan">
              New parent case
            </p>
            <input
              value={caseForm.type}
              onChange={(e) => setCaseForm((f) => ({ ...f, type: e.target.value }))}
              placeholder="Case type / title (e.g. Armed robbery — 5th & Main)"
              className="w-full px-3 py-2 rounded-lg border border-white/10 bg-black/30 text-sm text-white"
              required
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                value={caseForm.location}
                onChange={(e) => setCaseForm((f) => ({ ...f, location: e.target.value }))}
                placeholder="Location"
                className="px-3 py-2 rounded-lg border border-white/10 bg-black/30 text-sm text-white"
                required
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
              disabled={saving}
              className="w-full py-2 rounded-lg bg-serpico-blue/80 text-white text-xs font-display uppercase tracking-wider hover:bg-serpico-blue disabled:opacity-50"
            >
              Create case
            </button>
          </form>
        )}

        {loading ? (
          <p className="text-center text-sm text-neon-cyan animate-pulse py-8">Loading cases…</p>
        ) : cases.length === 0 ? (
          <div className="game-panel p-6 text-center space-y-2">
            <p className="text-sm text-gray-300">No investigation cases yet.</p>
            <p className="text-xs text-synth-muted">
              Create a case first — notes can only be added under a case parent.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {cases.map((c) => {
              const open = !!expanded[c.id];
              const notes = c.notes || [];
              const isSelected = selectedCaseId === c.id;
              return (
                <div
                  key={c.id}
                  className={`game-panel border overflow-hidden ${
                    isSelected ? 'border-neon-cyan/50' : 'border-white/10'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleCase(c.id)}
                    className="w-full flex items-start gap-2 px-3 py-2.5 text-left hover:bg-white/5"
                  >
                    <span className="text-neon-cyan font-mono text-xs mt-0.5 w-4 flex-shrink-0">
                      {open ? '▼' : '▶'}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[9px] font-display uppercase tracking-wider text-neon-amber">
                          Case
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
                        {c.date} · {c.location} · {notes.length} note{notes.length === 1 ? '' : 's'}
                      </p>
                    </div>
                  </button>

                  {open && (
                    <div className="border-t border-white/10 bg-black/20 px-3 py-2 space-y-2">
                      {c.description && (
                        <p className="text-[11px] text-gray-400 leading-snug px-1">{c.description}</p>
                      )}

                      {notes.length === 0 ? (
                        <p className="text-[11px] text-synth-muted px-1 py-1">
                          No notes under this case yet.
                        </p>
                      ) : (
                        notes.map((note) => (
                          <div
                            key={note.id}
                            className="rounded-lg border border-white/10 bg-black/30 px-2.5 py-2 space-y-1"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="text-[9px] font-display uppercase tracking-wider text-serpico-blue">
                                  Note
                                </p>
                                <p className="text-sm font-semibold text-white truncate">{note.title}</p>
                                <p className="text-[10px] text-synth-muted">
                                  {note.authorName} · {new Date(note.updatedAt).toLocaleString()}
                                </p>
                              </div>
                              <div className="flex gap-1 flex-shrink-0">
                                <button
                                  type="button"
                                  onClick={() => startEditNote(note)}
                                  className="px-2 py-0.5 text-[9px] uppercase border border-white/15 rounded text-gray-300"
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => removeNote(note.id)}
                                  className="px-2 py-0.5 text-[9px] uppercase border border-serpico-red/40 rounded text-serpico-red"
                                >
                                  Del
                                </button>
                              </div>
                            </div>
                            <p className="text-[12px] text-gray-300 whitespace-pre-wrap leading-snug">
                              {note.body}
                            </p>
                          </div>
                        ))
                      )}

                      <button
                        type="button"
                        onClick={() => startNewNote(c.id)}
                        className="w-full py-1.5 rounded-md text-[10px] font-display uppercase tracking-wider border border-neon-amber/40 text-neon-amber hover:bg-neon-amber/10"
                      >
                        + Add note under this case
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {selectedCase && (
          <div className="game-panel p-3 space-y-2 border border-neon-amber/35">
            <p className="text-[10px] font-display uppercase tracking-wider text-neon-amber">
              {editingNote ? 'Edit note' : 'New note'} · under case: {selectedCase.type}
            </p>
            <input
              value={noteForm.title}
              onChange={(e) => setNoteForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Note title"
              className="w-full px-3 py-2 rounded-lg border border-white/10 bg-black/30 text-sm text-white"
            />
            <textarea
              value={noteForm.body}
              onChange={(e) => setNoteForm((f) => ({ ...f, body: e.target.value }))}
              placeholder="Investigation notes, observations, leads…"
              rows={5}
              className="w-full px-3 py-2 rounded-lg border border-white/10 bg-black/30 text-sm text-white resize-y"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={saveNote}
                disabled={saving || !noteForm.title.trim() || !noteForm.body.trim()}
                className="flex-1 py-2 rounded-lg bg-serpico-blue/80 text-white text-xs font-display uppercase tracking-wider hover:bg-serpico-blue disabled:opacity-40"
              >
                {editingNote ? 'Update note' : 'Save note'}
              </button>
              {editingNote && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingNote(null);
                    setNoteForm({ title: '', body: '' });
                  }}
                  className="px-3 py-2 rounded-lg border border-white/15 text-xs text-gray-300"
                >
                  Cancel
                </button>
              )}
            </div>
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
          </div>
        </section>
      </div>
    </div>
  );
};

export default Notes;
