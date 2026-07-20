import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { adminAPI } from '../services/api';
import './DataViewer.css';

interface DataItem {
  [key: string]: unknown;
}

const DataViewer: React.FC = () => {
  const { module } = useParams<{ module: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<DataItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      if (module !== 'users') {
        setError('This module was removed from admin');
        setLoading(false);
        return;
      }
      try {
        const response = await adminAPI.getAllUsers();
        setData(response.data.users || []);
      } catch (err: any) {
        setError(err.response?.data?.error || 'Failed to fetch users');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [module]);

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

  if (error) {
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
