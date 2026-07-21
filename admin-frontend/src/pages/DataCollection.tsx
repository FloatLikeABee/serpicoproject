import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminAPI } from '../services/api';
import './DataCollection.css';

type IntelStatus = {
  enabled: boolean;
  last_run_at?: string;
  next_run_at?: string;
  last_error?: string;
  last_added?: number;
  last_news?: number;
  last_knowledge?: number;
  runs_today?: number;
  pieces_today?: number;
  interval_hours?: number;
  pieces_per_run?: number;
  max_pieces_per_day?: number;
  running?: boolean;
};

type NewsItem = {
  id: string;
  title: string;
  location?: string;
  source_url?: string;
  created_at: string;
  summary?: string;
};

const DataCollection: React.FC = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState<IntelStatus | null>(null);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [statusRes, newsRes] = await Promise.all([
        adminAPI.getDailyIntelStatus(),
        adminAPI.getDailyIntelNews(20),
      ]);
      setStatus(statusRes.data.status || null);
      setNews(newsRes.data.news || []);
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err.response?.data?.error || 'Failed to load daily intel status',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => {
      void refresh();
    }, 15000);
    return () => window.clearInterval(id);
  }, [refresh]);

  const handleRun = async () => {
    setRunning(true);
    setMessage(null);
    try {
      await adminAPI.runDailyIntel(true);
      setMessage({
        type: 'success',
        text: 'Collection started. Fresh pieces appear here after the AI finishes (usually under a minute).',
      });
      window.setTimeout(() => {
        void refresh();
      }, 8000);
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err.response?.data?.error || 'Failed to start collection',
      });
    } finally {
      setRunning(false);
    }
  };

  const formatTime = (value?: string) => {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime()) || d.getFullYear() < 2000) return '—';
    return d.toLocaleString();
  };

  return (
    <div className="admin-page data-collection">
      <header className="admin-header-bar">
        <button type="button" onClick={() => navigate('/')} className="btn btn-ghost">
          ← Back
        </button>
        <h1 className="neon-title">Data Collection</h1>
        <p className="muted">
          AI web search twice daily — crime news, case studies, and solved cold cases (US + worldwide).
          Knowledge goes to RAG; news is summarized to Markdown for frontline AI.
        </p>
      </header>

      {message && <div className={`message ${message.type}`}>{message.text}</div>}

      {loading ? (
        <div className="admin-panel status-message muted">Loading intel status…</div>
      ) : (
        <>
          <section className="admin-panel intel-status">
            <div className="intel-status-top">
              <div>
                <h2>Auto intel</h2>
                <p className="muted">
                  {status?.enabled ? 'Enabled' : 'Disabled'} · every {status?.interval_hours ?? 12}h ·
                  up to {status?.pieces_per_run ?? 2}/run · max {status?.max_pieces_per_day ?? 3}/day
                </p>
              </div>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleRun}
                disabled={running || status?.running}
              >
                {running || status?.running ? 'Running…' : 'Run now'}
              </button>
            </div>

            <dl className="intel-grid">
              <div>
                <dt>Last run</dt>
                <dd>{formatTime(status?.last_run_at)}</dd>
              </div>
              <div>
                <dt>Next run</dt>
                <dd>{formatTime(status?.next_run_at)}</dd>
              </div>
              <div>
                <dt>Today</dt>
                <dd>
                  {status?.pieces_today ?? 0} pieces · {status?.runs_today ?? 0} runs
                </dd>
              </div>
              <div>
                <dt>Last result</dt>
                <dd>
                  {status?.last_added ?? 0} added
                  {typeof status?.last_news === 'number' || typeof status?.last_knowledge === 'number'
                    ? ` (${status?.last_news ?? 0} news / ${status?.last_knowledge ?? 0} knowledge)`
                    : ''}
                </dd>
              </div>
            </dl>

            {status?.last_error ? (
              <p className="intel-error">Last note: {status.last_error}</p>
            ) : null}
          </section>

          <section className="news-list">
            <h2 className="section-title">Recent news digests</h2>
            {news.length === 0 ? (
              <div className="admin-panel status-message muted">
                No news digests yet. Run collection or wait for the next scheduled pass.
              </div>
            ) : (
              news.map((item) => (
                <article key={item.id} className="admin-panel news-card">
                  <h3>{item.title}</h3>
                  <div className="news-meta muted">
                    <span>{formatTime(item.created_at)}</span>
                    {item.location ? <span>{item.location}</span> : null}
                  </div>
                  {item.summary ? <p className="news-summary">{item.summary}</p> : null}
                  {item.source_url ? (
                    <a className="news-link" href={item.source_url} target="_blank" rel="noreferrer">
                      Source
                    </a>
                  ) : null}
                </article>
              ))
            )}
          </section>

          <p className="muted footnote">
            Knowledge pieces appear under RAG Training (tagged <code>auto_intel</code>).
            News Markdown is stored on the backend and injected into frontline Officer Serpico chat.
          </p>
        </>
      )}
    </div>
  );
};

export default DataCollection;
