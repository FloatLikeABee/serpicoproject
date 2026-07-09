import React, { useCallback, useEffect, useMemo, useState } from 'react';
import ChatMarkdown from '../../components/ChatMarkdown';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import {
  mysteriesAPI,
  MysteryBriefing,
  MysteryCase,
  MysteryInsight,
  MysteriesStatus,
} from '../../services/api';

type MainTab = 'cases' | 'briefings' | 'insights';
type CaseFilter = 'all' | 'missing_person' | 'cold_case' | 'unsolved_crime' | 'fugitive';

const CASE_FILTERS: Array<{ id: CaseFilter; label: string; accent: string }> = [
  { id: 'all', label: 'All', accent: '#00f5ff' },
  { id: 'missing_person', label: 'Missing', accent: '#ff6b9d' },
  { id: 'cold_case', label: 'Cold Cases', accent: '#a78bfa' },
  { id: 'unsolved_crime', label: 'Unsolved', accent: '#fbbf24' },
  { id: 'fugitive', label: 'On the Run', accent: '#fb7185' },
];

function categoryMeta(category: string) {
  switch (category) {
    case 'missing_person':
      return { label: 'Missing Person', color: '#ff6b9d', bg: 'rgba(255,107,157,0.15)' };
    case 'cold_case':
      return { label: 'Cold Case', color: '#a78bfa', bg: 'rgba(167,139,250,0.15)' };
    case 'fugitive':
      return { label: 'Fugitive', color: '#fb7185', bg: 'rgba(251,113,133,0.15)' };
    default:
      return { label: 'Unsolved', color: '#fbbf24', bg: 'rgba(251,191,36,0.15)' };
  }
}

function formatWhen(iso?: string) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function relativeRefresh(iso?: string) {
  if (!iso) return 'pending';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'pending';
  const diff = d.getTime() - Date.now();
  if (diff <= 0) return 'due now';
  const mins = Math.round(diff / 60000);
  if (mins < 60) return `in ${mins}m`;
  const hrs = Math.round(mins / 60);
  return `in ${hrs}h`;
}

const Mysteries: React.FC = () => {
  const { theme } = useTheme();
  const { user } = useAuth();
  const isDark = theme === 'dark';

  const [mainTab, setMainTab] = useState<MainTab>('cases');
  const [caseFilter, setCaseFilter] = useState<CaseFilter>('all');
  const [cases, setCases] = useState<MysteryCase[]>([]);
  const [briefings, setBriefings] = useState<MysteryBriefing[]>([]);
  const [latestBriefing, setLatestBriefing] = useState<MysteryBriefing | null>(null);
  const [insights, setInsights] = useState<MysteryInsight[]>([]);
  const [status, setStatus] = useState<MysteriesStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [form, setForm] = useState({
    authorName: user?.name || '',
    title: '',
    body: '',
    category: 'missing_person',
  });

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [casesRes, briefRes, insightRes] = await Promise.all([
        mysteriesAPI.listCases(caseFilter),
        mysteriesAPI.listBriefings(),
        mysteriesAPI.listInsights(),
      ]);
      setCases(casesRes.cases || []);
      setStatus(casesRes.status || briefRes.status);
      setBriefings(briefRes.briefings || []);
      setLatestBriefing(briefRes.latest);
      setInsights(insightRes.insights || []);
    } catch (err) {
      console.error(err);
      setError('Unable to reach the Mysteries desk. Check backend connection.');
    } finally {
      setLoading(false);
    }
  }, [caseFilter]);

  useEffect(() => {
    loadAll();
    const id = window.setInterval(loadAll, 5 * 60 * 1000);
    return () => window.clearInterval(id);
  }, [loadAll]);

  useEffect(() => {
    if (user?.name && !form.authorName) {
      setForm((f) => ({ ...f, authorName: user.name || '' }));
    }
  }, [user, form.authorName]);

  const filteredCases = useMemo(() => {
    if (caseFilter === 'all') return cases;
    return cases.filter((c) => c.category === caseFilter);
  }, [cases, caseFilter]);

  const onSubmitInsight = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.body.trim()) return;
    setSubmitting(true);
    setSubmitMsg(null);
    try {
      const { insight } = await mysteriesAPI.submitInsight({
        authorName: form.authorName.trim() || 'Anonymous Officer',
        title: form.title.trim(),
        body: form.body.trim(),
        category: form.category,
      });
      if (insight.factCheckStatus === 'verified') {
        setSubmitMsg({ ok: true, text: 'Verified and posted. Thank you for the tip.' });
        setForm((f) => ({ ...f, title: '', body: '' }));
        const refreshed = await mysteriesAPI.listInsights();
        setInsights(refreshed.insights || []);
      } else {
        setSubmitMsg({
          ok: false,
          text: insight.factCheckNotes || 'AI fact-check rejected this tip. Please revise with verifiable details.',
        });
      }
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
        : undefined;
      setSubmitMsg({ ok: false, text: msg || 'Fact-check failed. Try again shortly.' });
    } finally {
      setSubmitting(false);
    }
  };

  const tabs: Array<{ id: MainTab; label: string; hint: string }> = [
    { id: 'cases', label: 'Case Feed', hint: 'Missing · Cold · Unsolved · Fugitives' },
    { id: 'briefings', label: 'AI Briefings', hint: 'Auto-updated every hour' },
    { id: 'insights', label: 'Officer Insights', hint: 'AI fact-checked tips' },
  ];

  return (
    <div className={`page-fill relative overflow-hidden ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <div
        className="pointer-events-none absolute inset-0 opacity-90"
        style={{
          background:
            'radial-gradient(ellipse at 10% -10%, rgba(255,43,214,0.22), transparent 45%), radial-gradient(ellipse at 90% 0%, rgba(0,245,255,0.16), transparent 40%), radial-gradient(ellipse at 50% 100%, rgba(123,47,247,0.18), transparent 50%)',
        }}
      />

      <div className="relative z-10 flex h-full flex-col">
        <header className="game-header flex-shrink-0 border-b border-white/5 px-3 py-3 sm:px-5 sm:py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-serpico-blue/80">
                Serpico Desk
              </p>
              <h1 className="font-display text-2xl font-bold tracking-wide text-serpico-red sm:text-3xl">
                Mysteries
              </h1>
              <p className={`mt-1 max-w-xl text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                Live US missing persons, cold cases, unsolved crimes, and suspects on the run —
                AI-sourced from recent news.
              </p>
            </div>
            <button
              type="button"
              onClick={loadAll}
              className="rounded-xl border border-serpico-blue/40 bg-serpico-blue/10 px-3 py-2 text-xs font-semibold text-serpico-blue transition hover:bg-serpico-blue/20"
            >
              Refresh
            </button>
          </div>

          {status && (
            <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
              <span className="rounded-full border border-white/10 bg-black/25 px-2.5 py-1 text-gray-300">
                {status.caseCount}/50 cases · next {relativeRefresh(status.casesNextRefresh)}
              </span>
              <span className="rounded-full border border-white/10 bg-black/25 px-2.5 py-1 text-gray-300">
                Briefing {relativeRefresh(status.briefingNextRefresh)}
              </span>
              {(status.casesRefreshing || status.briefingRefreshing) && (
                <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-1 text-amber-200">
                  AI scanning news…
                </span>
              )}
            </div>
          )}

          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
            {tabs.map((tab) => {
              const active = mainTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setMainTab(tab.id)}
                  className={`min-w-[7.5rem] flex-shrink-0 rounded-2xl border px-3 py-2.5 text-left transition ${
                    active
                      ? 'border-serpico-red/50 bg-serpico-red/15 shadow-[0_0_24px_rgba(255,43,214,0.25)]'
                      : 'border-white/10 bg-black/20 hover:border-white/25'
                  }`}
                >
                  <div className={`text-sm font-semibold ${active ? 'text-white' : 'text-gray-300'}`}>
                    {tab.label}
                  </div>
                  <div className="mt-0.5 text-[10px] text-gray-400">{tab.hint}</div>
                </button>
              );
            })}
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-5 sm:py-4">
          {error && (
            <div className="mb-3 rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {error}
            </div>
          )}

          {loading && cases.length === 0 && briefings.length === 0 ? (
            <div className="flex h-48 items-center justify-center text-sm text-gray-400">
              Loading Mysteries desk…
            </div>
          ) : null}

          {mainTab === 'cases' && (
            <div className="space-y-3">
              <div className="flex gap-2 overflow-x-auto pb-1">
                {CASE_FILTERS.map((f) => {
                  const active = caseFilter === f.id;
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setCaseFilter(f.id)}
                      className={`flex-shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                        active ? 'text-black' : 'border border-white/10 bg-black/25 text-gray-300'
                      }`}
                      style={active ? { backgroundColor: f.accent } : undefined}
                    >
                      {f.label}
                    </button>
                  );
                })}
              </div>

              {filteredCases.length === 0 && !loading ? (
                <div className="rounded-2xl border border-dashed border-white/15 bg-black/20 p-6 text-center text-sm text-gray-400">
                  No cases yet — AI is gathering recent US missing-person and cold-case news.
                  This feed refreshes every 2 hours (max 50).
                </div>
              ) : (
                filteredCases.map((item, idx) => {
                  const meta = categoryMeta(item.category);
                  return (
                    <article
                      key={item.id}
                      className="group relative overflow-hidden rounded-2xl border border-white/10 bg-black/30 p-4 backdrop-blur-sm transition hover:border-serpico-blue/40"
                      style={{
                        animation: `mysteryFadeIn 420ms ease ${Math.min(idx, 8) * 40}ms both`,
                      }}
                    >
                      <div
                        className="absolute inset-y-0 left-0 w-1"
                        style={{ background: meta.color }}
                      />
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                          style={{ color: meta.color, background: meta.bg }}
                        >
                          {meta.label}
                        </span>
                        {item.status && (
                          <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-gray-300">
                            {item.status}
                          </span>
                        )}
                        <span className="text-[10px] text-gray-500">{item.date}</span>
                      </div>
                      <h2 className="mt-2 font-display text-base font-semibold leading-snug text-white sm:text-lg">
                        {item.title}
                      </h2>
                      <div className="mt-1.5 flex flex-wrap gap-3 text-[11px] text-gray-400">
                        <span>📍 {item.location || 'United States'}</span>
                        {item.sourceName && <span>📰 {item.sourceName}</span>}
                      </div>
                      <p className="mt-2 text-sm leading-relaxed text-gray-300">{item.summary}</p>
                      {item.sourceUrl && (
                        <a
                          href={item.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-3 inline-flex text-xs font-semibold text-serpico-blue hover:underline"
                        >
                          Open source →
                        </a>
                      )}
                    </article>
                  );
                })
              )}
            </div>
          )}

          {mainTab === 'briefings' && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-serpico-blue/25 bg-gradient-to-br from-serpico-blue/10 via-black/30 to-purple-900/20 p-4">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-serpico-blue">
                      Read-only · AI authored
                    </p>
                    <h2 className="mt-1 font-display text-lg font-bold text-white">
                      {latestBriefing?.title || 'Awaiting first briefing'}
                    </h2>
                  </div>
                  <span className="rounded-full border border-white/10 px-2 py-1 text-[10px] text-gray-400">
                    {formatWhen(latestBriefing?.createdAt || status?.briefingLastRefresh)}
                  </span>
                </div>
                <p className="mt-2 text-xs text-gray-400">
                  Users cannot edit this feed. AI web-searches cases and posts a new briefing every hour.
                </p>
              </div>

              {!latestBriefing && !loading ? (
                <div className="rounded-2xl border border-dashed border-white/15 bg-black/20 p-6 text-center text-sm text-gray-400">
                  No briefing yet. The desk will publish once news scan completes.
                </div>
              ) : null}

              {(briefings.length ? briefings : latestBriefing ? [latestBriefing] : []).map((b) => (
                <article
                  key={b.id}
                  className="rounded-2xl border border-white/10 bg-black/35 p-4 sm:p-5"
                >
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <h3 className="font-display text-base font-semibold text-white">{b.title}</h3>
                    <span className="text-[10px] text-gray-500">{formatWhen(b.createdAt)}</span>
                  </div>
                  <ChatMarkdown content={b.bodyMd} size="sm" />
                  {b.sources?.length > 0 && (
                    <div className="mt-4 border-t border-white/10 pt-3">
                      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                        Sources
                      </p>
                      <ul className="space-y-1">
                        {b.sources.slice(0, 6).map((src) => (
                          <li key={src}>
                            <a
                              href={src}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="break-all text-xs text-serpico-blue hover:underline"
                            >
                              {src}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}

          {mainTab === 'insights' && (
            <div className="space-y-4">
              <form
                onSubmit={onSubmitInsight}
                className="rounded-2xl border border-serpico-red/25 bg-gradient-to-br from-serpico-red/10 via-black/35 to-black/20 p-4"
              >
                <h2 className="font-display text-lg font-bold text-white">Share an insight</h2>
                <p className="mt-1 text-xs text-gray-400">
                  Tips are AI fact-checked before posting. Paranormal claims, conspiracies, and unverifiable
                  rumors are rejected.
                </p>

                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="block text-xs text-gray-400">
                    Name
                    <input
                      value={form.authorName}
                      onChange={(e) => setForm((f) => ({ ...f, authorName: e.target.value }))}
                      className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-serpico-blue/50"
                      placeholder="Officer name"
                    />
                  </label>
                  <label className="block text-xs text-gray-400">
                    Category
                    <select
                      value={form.category}
                      onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                      className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-serpico-blue/50"
                    >
                      <option value="missing_person">Missing person</option>
                      <option value="cold_case">Cold case</option>
                      <option value="unsolved_crime">Unsolved crime</option>
                      <option value="fugitive">Fugitive / on the run</option>
                    </select>
                  </label>
                </div>

                <label className="mt-3 block text-xs text-gray-400">
                  Title
                  <input
                    value={form.title}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                    className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-serpico-blue/50"
                    placeholder="Short tip headline"
                    maxLength={160}
                    required
                  />
                </label>

                <label className="mt-3 block text-xs text-gray-400">
                  Insight
                  <textarea
                    value={form.body}
                    onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                    className="mt-1 min-h-[110px] w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-serpico-blue/50"
                    placeholder="Share a useful, verifiable lead or investigative note…"
                    maxLength={2000}
                    required
                  />
                </label>

                {submitMsg && (
                  <div
                    className={`mt-3 rounded-xl border px-3 py-2 text-xs ${
                      submitMsg.ok
                        ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200'
                        : 'border-amber-400/30 bg-amber-500/10 text-amber-100'
                    }`}
                  >
                    {submitMsg.text}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="mt-3 rounded-xl bg-serpico-red px-4 py-2.5 text-sm font-bold text-white shadow-[0_0_20px_rgba(255,43,214,0.35)] transition hover:brightness-110 disabled:opacity-60"
                >
                  {submitting ? 'Fact-checking…' : 'Submit for AI fact-check'}
                </button>
              </form>

              <div className="space-y-3">
                {insights.length === 0 && !loading ? (
                  <div className="rounded-2xl border border-dashed border-white/15 bg-black/20 p-6 text-center text-sm text-gray-400">
                    No verified insights yet. Be the first to share a useful tip.
                  </div>
                ) : (
                  insights.map((insight) => {
                    const meta = categoryMeta(insight.category);
                    return (
                      <article
                        key={insight.id}
                        className="rounded-2xl border border-white/10 bg-black/30 p-4"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase"
                            style={{ color: meta.color, background: meta.bg }}
                          >
                            {meta.label}
                          </span>
                          <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-200">
                            AI verified
                          </span>
                          <span className="text-[10px] text-gray-500">{formatWhen(insight.createdAt)}</span>
                        </div>
                        <h3 className="mt-2 font-display text-base font-semibold text-white">
                          {insight.title}
                        </h3>
                        <p className="mt-1 text-xs text-gray-500">by {insight.authorName}</p>
                        <p className="mt-2 text-sm leading-relaxed text-gray-300">{insight.body}</p>
                        {insight.factCheckNotes && (
                          <p className="mt-2 text-[11px] italic text-gray-500">
                            Fact-check: {insight.factCheckNotes}
                          </p>
                        )}
                      </article>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes mysteryFadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default Mysteries;
