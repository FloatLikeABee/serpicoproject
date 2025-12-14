import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { adminAPI } from '../services/api';
import './DataViewer.css';

interface DataItem {
  [key: string]: any;
}

const DataViewer: React.FC = () => {
  const { module } = useParams<{ module: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<DataItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchData();
  }, [module]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
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
      const dataKey = module === 'cases' ? 'cases' : 
                     module === 'perps' ? 'perps' :
                     module === 'officers' ? 'officers' :
                     module === 'emergencies' ? 'emergencies' : 'users';
      setData(response.data[dataKey] || []);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

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
        <div className="error">Error: {error}</div>
      </div>
    );
  }

  const getHeaders = (): string[] => {
    if (data.length === 0) return [];
    return Object.keys(data[0]);
  };

  const handleAdd = () => {
    // Initialize form data based on module type
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
      let response;
      switch (module) {
        case 'cases':
          response = await adminAPI.createCase(formData);
          break;
        case 'perps':
          response = await adminAPI.createPerp(formData);
          break;
        case 'officers':
          response = await adminAPI.createOfficer(formData);
          break;
        case 'emergencies':
          response = await adminAPI.createEmergency(formData);
          break;
        default:
          return;
      }
      setShowForm(false);
      setFormData({});
      fetchData(); // Refresh data
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
    } else if (module === 'perps') {
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
    } else if (module === 'officers') {
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
    } else if (module === 'emergencies') {
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

  return (
    <div className="data-viewer">
      <header className="viewer-header">
        <div className="header-top">
          <button onClick={() => navigate('/')} className="back-button">
            ← Back to Dashboard
          </button>
          {(module === 'cases' || module === 'perps' || module === 'officers' || module === 'emergencies') && (
            <button onClick={handleAdd} className="add-button">
              + Add New
            </button>
          )}
        </div>
        <h1>{(module ? module.charAt(0).toUpperCase() + module.slice(1) : 'Unknown')} Data</h1>
        <p>Total Records: {data.length}</p>
      </header>

      {showForm && (
        <div className="form-overlay">
          <div className="form-container">
            <h2>Add New {(module ? module.charAt(0).toUpperCase() + module.slice(1) : '')}</h2>
            <form onSubmit={handleSubmit}>
              {getFormFields()}
              <div className="form-actions">
                <button type="submit" className="save-button">Create</button>
                <button type="button" onClick={() => { setShowForm(false); setFormData({}); }} className="cancel-button">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="table-container">
        {data.length === 0 ? (
          <div className="no-data">No data available</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                {getHeaders().map((header) => (
                  <th key={header}>{header.replace(/_/g, ' ').toUpperCase()}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((item, index) => (
                <tr key={index}>
                  {getHeaders().map((header) => (
                    <td key={header}>
                      {typeof item[header] === 'object'
                        ? JSON.stringify(item[header])
                        : String(item[header])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default DataViewer;

