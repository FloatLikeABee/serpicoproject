import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { adminAPI } from '../services/api';
import './DataViewer.css';

interface DataItem {
  [key: string]: any;
}

const MODULE_TITLES: Record<string, string> = {
  cases: 'Cases',
  perps: 'Suspects',
  officers: 'Officers',
  emergencies: 'Emergencies',
  users: 'Users',
};

const ALLOWED_MODULES = new Set(Object.keys(MODULE_TITLES));

const DataViewer: React.FC = () => {
  const { module } = useParams<{ module: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<DataItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<Record<string, string>>({});

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    if (!module || !ALLOWED_MODULES.has(module)) {
      setError('Invalid module');
      setLoading(false);
      return;
    }
    try {
      let response;
      switch (module) {
        case 'cases':
          response = await adminAPI.getAllCases();
          break;
        case 'perps':
          response = await adminAPI.getAllPerps();
          break;
        case 'officers':
          response = await adminAPI.getAllOfficers();
          break;
        case 'emergencies':
          response = await adminAPI.getAllEmergencies();
          break;
        case 'users':
          response = await adminAPI.getAllUsers();
          break;
        default:
          setError('Invalid module');
          return;
      }
      const dataKey =
        module === 'cases'
          ? 'cases'
          : module === 'perps'
            ? 'perps'
            : module === 'officers'
              ? 'officers'
              : module === 'emergencies'
                ? 'emergencies'
                : 'users';
      setData(response.data[dataKey] || []);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchData();
    // Reload when the route module changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [module]);

  const title = module ? MODULE_TITLES[module] || module : 'Unknown';
  const canAdd =
    module === 'cases' ||
    module === 'perps' ||
    module === 'officers' ||
    module === 'emergencies';

  if (loading) {
    return (
      <div className="data-viewer">
        <div className="loading">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="data-viewer">
        <button type="button" onClick={() => navigate('/')} className="back-button">
          ← Back
        </button>
        <div className="error">Error: {error}</div>
      </div>
    );
  }

  const getHeaders = (): string[] => {
    if (data.length === 0) return [];
    return Object.keys(data[0]);
  };

  const formatValue = (value: unknown) => {
    if (value == null) return '—';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  const handleAdd = () => {
    const initialData: Record<string, string> = {};
    if (module === 'cases') {
      initialData.type = '';
      initialData.location = '';
      initialData.date = new Date().toISOString().split('T')[0];
      initialData.description = '';
      initialData.status = 'Open';
    } else if (module === 'perps') {
      initialData.alias = '';
      initialData.location = '';
      initialData.last_seen = new Date().toISOString().split('T')[0];
      initialData.status = 'Active';
    } else if (module === 'officers') {
      initialData.name = '';
      initialData.rank = '';
      initialData.vehicle_plate = '';
      initialData.vehicle_number = '';
      initialData.current_location = '';
      initialData.status = 'Active';
    } else if (module === 'emergencies') {
      initialData.type = '';
      initialData.location = '';
      initialData.priority = 'Medium';
      initialData.category = '';
      initialData.assigned_officer_id = '';
      initialData.status = 'Open';
    }
    setFormData(initialData);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      switch (module) {
        case 'cases':
          await adminAPI.createCase(formData);
          break;
        case 'perps':
          await adminAPI.createPerp(formData);
          break;
        case 'officers':
          await adminAPI.createOfficer(formData);
          break;
        case 'emergencies':
          await adminAPI.createEmergency(formData);
          break;
        default:
          return;
      }
      setShowForm(false);
      setFormData({});
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create record');
    }
  };

  const getFormFields = () => {
    if (module === 'cases') {
      return (
        <>
          <div className="form-group">
            <label>Type *</label>
            <input
              type="text"
              value={formData.type || ''}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <label>Location *</label>
            <input
              type="text"
              value={formData.location || ''}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <label>Date *</label>
            <input
              type="date"
              value={formData.date || ''}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <label>Status</label>
            <select
              value={formData.status || 'Open'}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
            >
              <option value="Open">Open</option>
              <option value="Solved">Solved</option>
              <option value="Closed">Closed</option>
            </select>
          </div>
          <div className="form-group">
            <label>Description</label>
            <textarea
              value={formData.description || ''}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={4}
            />
          </div>
        </>
      );
    }
    if (module === 'perps') {
      return (
        <>
          <div className="form-group">
            <label>Alias *</label>
            <input
              type="text"
              value={formData.alias || ''}
              onChange={(e) => setFormData({ ...formData, alias: e.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <label>Location</label>
            <input
              type="text"
              value={formData.location || ''}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>Last Seen</label>
            <input
              type="date"
              value={formData.last_seen || ''}
              onChange={(e) => setFormData({ ...formData, last_seen: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>Status</label>
            <select
              value={formData.status || 'Active'}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
            >
              <option value="Active">Active</option>
              <option value="Wanted">Wanted</option>
              <option value="In Custody">In Custody</option>
            </select>
          </div>
        </>
      );
    }
    if (module === 'officers') {
      return (
        <>
          <div className="form-group">
            <label>Name *</label>
            <input
              type="text"
              value={formData.name || ''}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <label>Rank *</label>
            <input
              type="text"
              value={formData.rank || ''}
              onChange={(e) => setFormData({ ...formData, rank: e.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <label>Vehicle Plate</label>
            <input
              type="text"
              value={formData.vehicle_plate || ''}
              onChange={(e) => setFormData({ ...formData, vehicle_plate: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>Vehicle Number</label>
            <input
              type="text"
              value={formData.vehicle_number || ''}
              onChange={(e) => setFormData({ ...formData, vehicle_number: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>Current Location</label>
            <input
              type="text"
              value={formData.current_location || ''}
              onChange={(e) => setFormData({ ...formData, current_location: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>Status</label>
            <select
              value={formData.status || 'Active'}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
            >
              <option value="Active">Active</option>
              <option value="Off-Duty">Off-Duty</option>
              <option value="On Leave">On Leave</option>
            </select>
          </div>
        </>
      );
    }
    if (module === 'emergencies') {
      return (
        <>
          <div className="form-group">
            <label>Type *</label>
            <input
              type="text"
              value={formData.type || ''}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <label>Location *</label>
            <input
              type="text"
              value={formData.location || ''}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <label>Priority</label>
            <select
              value={formData.priority || 'Medium'}
              onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
            >
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
            </select>
          </div>
          <div className="form-group">
            <label>Category *</label>
            <input
              type="text"
              value={formData.category || ''}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <label>Assigned Officer ID</label>
            <input
              type="text"
              value={formData.assigned_officer_id || ''}
              onChange={(e) => setFormData({ ...formData, assigned_officer_id: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>Status</label>
            <select
              value={formData.status || 'Open'}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
            >
              <option value="Open">Open</option>
              <option value="In Progress">In Progress</option>
              <option value="Resolved">Resolved</option>
            </select>
          </div>
        </>
      );
    }
    return null;
  };

  const headers = getHeaders();
  const primaryKey = headers[0];
  const secondaryKeys = headers.slice(1, 5);

  return (
    <div className="data-viewer">
      <header className="viewer-header">
        <div className="header-top">
          <button type="button" onClick={() => navigate('/')} className="back-button">
            ← Back
          </button>
          {canAdd && (
            <button type="button" onClick={handleAdd} className="add-button">
              + Add
            </button>
          )}
        </div>
        <h1>{title}</h1>
        <p>{data.length} record{data.length === 1 ? '' : 's'}</p>
      </header>

      {showForm && (
        <div className="form-overlay" onClick={() => { setShowForm(false); setFormData({}); }}>
          <div className="form-container" onClick={(e) => e.stopPropagation()}>
            <h2>Add {title}</h2>
            <form onSubmit={handleSubmit}>
              {getFormFields()}
              <div className="form-actions">
                <button type="submit" className="save-button">Create</button>
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setFormData({}); }}
                  className="cancel-button"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {data.length === 0 ? (
        <div className="no-data">No data available</div>
      ) : (
        <>
          <div className="mobile-cards">
            {data.map((item, index) => (
              <article key={index} className="data-card">
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

          <div className="table-container desktop-only">
            <table className="data-table">
              <thead>
                <tr>
                  {headers.map((header) => (
                    <th key={header}>{header.replace(/_/g, ' ').toUpperCase()}</th>
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
