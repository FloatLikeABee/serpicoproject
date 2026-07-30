import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { InvestigationCase, investigationAPI } from '../services/api';

/** Cases list — open a case to work its timeline nodes. */
const Notes: React.FC = () => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const isDark = theme === 'dark';

  const [cases, setCases] = useState<InvestigationCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCaseForm, setShowCaseForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [caseForm, setCaseForm] = useState({
    type: '',
    location: '',
    date: new Date().toISOString().slice(0, 10),
    description: '',
  });

  const loadCases = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { cases: list } = await investigationAPI.listCases();
      setCases(list || []);
    } catch (err) {
      console.error(err);
      setError('Unable to load cases. Check backend connection.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCases();
  }, [loadCases]);

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
      navigate(`/notes/${created.id}`);
    } catch (err) {
      console.error(err);
      setError('Could not create case.');
    } finally {
      setSaving(false);
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
              Open a case to add timeline nodes — place, location, name, time, event, analysis.
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
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                value={caseForm.location}
                onChange={(e) => setCaseForm((f) => ({ ...f, location: e.target.value }))}
                placeholder="Primary location"
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
              Create & open case
            </button>
          </form>
        )}

        {loading ? (
          <p className="text-center text-sm text-neon-cyan animate-pulse py-8">Loading cases…</p>
        ) : cases.length === 0 ? (
          <div className="game-panel p-6 text-center space-y-2">
            <p className="text-sm text-gray-300">No cases yet.</p>
            <p className="text-xs text-synth-muted">Create a case, then add timed investigation nodes.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {cases.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => navigate(`/notes/${c.id}`)}
                className="w-full game-panel border border-white/10 px-3 py-3 text-left hover:border-neon-cyan/40 hover:bg-white/5 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
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
                      {c.date} · {c.location}
                    </p>
                    {c.description && (
                      <p className="text-[11px] text-gray-400 mt-1 line-clamp-2">{c.description}</p>
                    )}
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <p className="text-lg font-display font-bold text-neon-cyan tabular-nums">
                      {c.nodeCount ?? 0}
                    </p>
                    <p className="text-[9px] uppercase text-synth-muted">nodes</p>
                  </div>
                </div>
              </button>
            ))}
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
