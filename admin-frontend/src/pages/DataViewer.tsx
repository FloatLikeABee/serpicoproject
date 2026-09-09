import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { adminAPI } from '../services/api';
import './DataViewer.css';

interface DataItem {
  [key: string]: unknown;
}

interface InviteItem {
  id?: string;
  code: string;
  username: string;
  password: string;
  note?: string;
}

const DataViewer: React.FC = () => {
  const { module } = useParams<{ module: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<DataItem[]>([]);
  const [invites, setInvites] = useState<InviteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [generating, setGenerating] = useState(false);
  const [copyFlash, setCopyFlash] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    if (module !== 'users') {
      setError('This module was removed from admin');
      setLoading(false);
      return;
    }
    try {
      const [usersRes, invitesRes] = await Promise.all([
        adminAPI.getAllUsers(),
        adminAPI.listInvites(),
      ]);
      setData(usersRes.data.users || []);
      setInvites(invitesRes.data.invites || []);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  }, [module]);

  useEffect(() => {
    void load();
  }, [load]);

  const copyText = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopyFlash(`Copied ${label}`);
    } catch {
      setCopyFlash(`Could not copy ${label}`);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const response = await adminAPI.createInvite(note.trim());
      const created = response.data as InviteItem;
      setInvites((prev) => [created, ...prev]);
      setNote('');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create invitation');
    } finally {
      setGenerating(false);
    }
  };

  const getHeaders = (): string[] => {
    if (data.length === 0) return [];
    return Object.keys(data[0]);
  };

  const formatValue = (value: unknown) => {
    if (value == null) return '—';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  if (loading) {
    return (
      <div className="admin-page data-viewer">
        <div className="status-message muted">Loading…</div>
      </div>
    );
  }

  if (error && data.length === 0 && invites.length === 0) {
    return (
      <div className="admin-page data-viewer">
        <button type="button" onClick={() => navigate('/')} className="btn btn-ghost">
          ← Back
        </button>
        <div className="status-message error">{error}</div>
      </div>
    );
  }

  const headers = getHeaders();
  const primaryKey = headers[0];
  const secondaryKeys = headers.slice(1, 5);

  return (
    <div className="admin-page data-viewer">
      <header className="admin-header-bar">
        <div className="header-top">
          <button type="button" onClick={() => navigate('/')} className="btn btn-ghost">
            ← Back
          </button>
        </div>
        <h1 className="neon-title">Users</h1>
        <p className="muted">
          {data.length} account{data.length === 1 ? '' : 's'}
        </p>
      </header>

      <section className="admin-panel invite-panel">
        <h2 className="invite-heading">Invitations</h2>
        <p className="muted">Mint a long unique code and a username/password. Email the code yourself.</p>
        <div className="invite-generate">
          <label className="invite-note-label">
            Note (optional)
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="invite-note"
              placeholder="Who this code is for"
            />
          </label>
          <button type="button" className="btn btn-primary" onClick={handleGenerate} disabled={generating}>
            {generating ? 'Generating…' : 'Generate'}
          </button>
        </div>
        {copyFlash ? <p className="muted">{copyFlash}</p> : null}
        {invites.length === 0 ? (
          <p className="muted">No invitations yet</p>
        ) : (
          <ul className="invite-list">
            {invites.map((inv) => (
              <li key={inv.id || inv.code} className="invite-row">
                <div>
                  <div className="invite-code">{inv.code}</div>
                  <div className="muted">
                    {inv.username} · {inv.password}
                    {inv.note ? ` · ${inv.note}` : ''}
                  </div>
                </div>
                <div className="invite-copy-actions">
                  <button type="button" className="btn btn-ghost" onClick={() => copyText('code', inv.code)}>
                    Copy code
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={() => copyText('username', inv.username)}>
                    Copy username
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={() => copyText('password', inv.password)}>
                    Copy password
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {error ? <div className="status-message error">{error}</div> : null}

      {data.length === 0 ? (
        <div className="admin-panel status-message muted">No users found</div>
      ) : (
        <>
          <div className="mobile-cards">
            {data.map((item, index) => (
              <article key={index} className="data-card admin-panel">
                <h3>{formatValue(item[primaryKey])}</h3>
                <dl>
                  {secondaryKeys.map((header) => (
                    <div key={header} className="data-card-row">
                      <dt>{header.replace(/_/g, ' ')}</dt>
                      <dd>{formatValue(item[header])}</dd>
                    </div>
                  ))}
                  {headers.length > 5 && (
                    <details className="data-card-more">
                      <summary>More fields</summary>
                      {headers.slice(5).map((header) => (
                        <div key={header} className="data-card-row">
                          <dt>{header.replace(/_/g, ' ')}</dt>
                          <dd>{formatValue(item[header])}</dd>
                        </div>
                      ))}
                    </details>
                  )}
                </dl>
              </article>
            ))}
          </div>

          <div className="table-container admin-panel desktop-only">
            <table className="data-table">
              <thead>
                <tr>
                  {headers.map((header) => (
                    <th key={header}>{header.replace(/_/g, ' ')}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map((item, index) => (
                  <tr key={index}>
                    {headers.map((header) => (
                      <td key={header}>{formatValue(item[header])}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};

export default DataViewer;
