import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminAPI } from '../services/api';
import './DataCollection.css';

type CollectionMethod = 'url' | 'api' | 'file';

const DataCollection: React.FC = () => {
  const navigate = useNavigate();
  const [method, setMethod] = useState<CollectionMethod>('url');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // URL collection form
  const [urlData, setUrlData] = useState({
    url: '',
    category: '',
    location: '',
    tags: '',
  });

  // API collection form
  const [apiData, setApiData] = useState({
    url: '',
    method: 'GET',
    headers: '',
    queryParams: '',
    dataPath: '',
    category: '',
    location: '',
    tags: '',
  });

  // File collection form
  const [fileData, setFileData] = useState({
    file: null as File | null,
    category: '',
    location: '',
    tags: '',
  });

  const handleUrlSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const tags = urlData.tags.split(',').map(t => t.trim()).filter(t => t);
      const response = await adminAPI.collectFromURL({
        url: urlData.url,
        category: urlData.category || 'web_content',
        location: urlData.location,
        tags,
      });

      setMessage({
        type: 'success',
        text: response.data.message || `Successfully collected ${response.data.documents_added} documents`,
      });

      // Reset form
      setUrlData({ url: '', category: '', location: '', tags: '' });
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.response?.data?.error || 'Failed to collect data from URL',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApiSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      // Parse headers
      const headers: Record<string, string> = {};
      if (apiData.headers) {
        apiData.headers.split('\n').forEach(line => {
          const [key, ...valueParts] = line.split(':');
          if (key && valueParts.length > 0) {
            headers[key.trim()] = valueParts.join(':').trim();
          }
        });
      }

      // Parse query params
      const queryParams: Record<string, string> = {};
      if (apiData.queryParams) {
        apiData.queryParams.split('\n').forEach(line => {
          const [key, value] = line.split('=');
          if (key && value) {
            queryParams[key.trim()] = value.trim();
          }
        });
      }

      const tags = apiData.tags.split(',').map(t => t.trim()).filter(t => t);
      const response = await adminAPI.collectFromAPI({
        api_config: {
          url: apiData.url,
          method: apiData.method,
          headers,
          query_params: queryParams,
          data_path: apiData.dataPath,
        },
        category: apiData.category || 'api_data',
        location: apiData.location,
        tags,
      });

      setMessage({
        type: 'success',
        text: response.data.message || `Successfully collected ${response.data.documents_added} documents`,
      });

      // Reset form
      setApiData({
        url: '',
        method: 'GET',
        headers: '',
        queryParams: '',
        dataPath: '',
        category: '',
        location: '',
        tags: '',
      });
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.response?.data?.error || 'Failed to collect data from API',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fileData.file) {
      setMessage({ type: 'error', text: 'Please select a file' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const formData = new FormData();
      formData.append('file', fileData.file);
      formData.append('category', fileData.category || 'file_import');
      if (fileData.location) formData.append('location', fileData.location);
      if (fileData.tags) formData.append('tags', fileData.tags);

      const response = await adminAPI.collectFromFile(formData);

      setMessage({
        type: 'success',
        text: response.data.message || `Successfully imported ${response.data.documents_added} documents`,
      });

      // Reset form
      setFileData({ file: null, category: '', location: '', tags: '' });
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.response?.data?.error || 'Failed to import file',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="data-collection">
      <header className="collection-header">
        <button onClick={() => navigate('/')} className="back-button">
          ← Back to Dashboard
        </button>
        <h1>Data Collection</h1>
        <p>Collect data from web pages, APIs, or files and convert to RAG format</p>
      </header>

      {message && (
        <div className={`message ${message.type}`}>
          {message.text}
        </div>
      )}

      <div className="collection-tabs">
        <button
          className={method === 'url' ? 'active' : ''}
          onClick={() => setMethod('url')}
        >
          🌐 Web Crawling
        </button>
        <button
          className={method === 'api' ? 'active' : ''}
          onClick={() => setMethod('api')}
        >
          🔌 API Collection
        </button>
        <button
          className={method === 'file' ? 'active' : ''}
          onClick={() => setMethod('file')}
        >
          📄 File Import
        </button>
      </div>

      <div className="collection-content">
        {method === 'url' && (
          <form onSubmit={handleUrlSubmit} className="collection-form">
            <h2>Web Crawling</h2>
            <p className="form-description">Enter a URL to crawl and extract content</p>

            <div className="form-group">
              <label>URL *</label>
              <input
                type="url"
                value={urlData.url}
                onChange={(e) => setUrlData({ ...urlData, url: e.target.value })}
                placeholder="https://example.com/article"
                required
              />
            </div>

            <div className="form-group">
              <label>Category</label>
              <input
                type="text"
                value={urlData.category}
                onChange={(e) => setUrlData({ ...urlData, category: e.target.value })}
                placeholder="web_content"
              />
            </div>

            <div className="form-group">
              <label>Location (optional)</label>
              <input
                type="text"
                value={urlData.location}
                onChange={(e) => setUrlData({ ...urlData, location: e.target.value })}
                placeholder="e.g., Point Pleasant, WV"
              />
            </div>

            <div className="form-group">
              <label>Tags (comma-separated)</label>
              <input
                type="text"
                value={urlData.tags}
                onChange={(e) => setUrlData({ ...urlData, tags: e.target.value })}
                placeholder="crime, statistics, news"
              />
            </div>

            <button type="submit" disabled={loading} className="submit-button">
              {loading ? 'Collecting...' : 'Collect Data'}
            </button>
          </form>
        )}

        {method === 'api' && (
          <form onSubmit={handleApiSubmit} className="collection-form">
            <h2>API Collection</h2>
            <p className="form-description">Configure API endpoint to fetch data</p>

            <div className="form-group">
              <label>API URL *</label>
              <input
                type="url"
                value={apiData.url}
                onChange={(e) => setApiData({ ...apiData, url: e.target.value })}
                placeholder="https://api.example.com/data"
                required
              />
            </div>

            <div className="form-group">
              <label>HTTP Method</label>
              <select
                value={apiData.method}
                onChange={(e) => setApiData({ ...apiData, method: e.target.value })}
              >
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="DELETE">DELETE</option>
              </select>
            </div>

            <div className="form-group">
              <label>Headers (one per line, format: Key: Value)</label>
              <textarea
                value={apiData.headers}
                onChange={(e) => setApiData({ ...apiData, headers: e.target.value })}
                placeholder="Authorization: Bearer token&#10;Content-Type: application/json"
                rows={4}
              />
            </div>

            <div className="form-group">
              <label>Query Parameters (one per line, format: key=value)</label>
              <textarea
                value={apiData.queryParams}
                onChange={(e) => setApiData({ ...apiData, queryParams: e.target.value })}
                placeholder="page=1&#10;limit=100"
                rows={3}
              />
            </div>

            <div className="form-group">
              <label>Data Path (JSON path to extract data, e.g., "data.items")</label>
              <input
                type="text"
                value={apiData.dataPath}
                onChange={(e) => setApiData({ ...apiData, dataPath: e.target.value })}
                placeholder="data.items"
              />
            </div>

            <div className="form-group">
              <label>Category</label>
              <input
                type="text"
                value={apiData.category}
                onChange={(e) => setApiData({ ...apiData, category: e.target.value })}
                placeholder="api_data"
              />
            </div>

            <div className="form-group">
              <label>Location (optional)</label>
              <input
                type="text"
                value={apiData.location}
                onChange={(e) => setApiData({ ...apiData, location: e.target.value })}
                placeholder="e.g., Point Pleasant, WV"
              />
            </div>

            <div className="form-group">
              <label>Tags (comma-separated)</label>
              <input
                type="text"
                value={apiData.tags}
                onChange={(e) => setApiData({ ...apiData, tags: e.target.value })}
                placeholder="api, data, external"
              />
            </div>

            <button type="submit" disabled={loading} className="submit-button">
              {loading ? 'Collecting...' : 'Collect Data'}
            </button>
          </form>
        )}

        {method === 'file' && (
          <form onSubmit={handleFileSubmit} className="collection-form">
            <h2>File Import</h2>
            <p className="form-description">Upload JSON, CSV, or TXT file to import data</p>

            <div className="form-group">
              <label>File *</label>
              <input
                type="file"
                accept=".json,.csv,.txt"
                onChange={(e) => setFileData({ ...fileData, file: e.target.files?.[0] || null })}
                required
              />
              <small>Supported formats: JSON, CSV, TXT</small>
            </div>

            <div className="form-group">
              <label>Category</label>
              <input
                type="text"
                value={fileData.category}
                onChange={(e) => setFileData({ ...fileData, category: e.target.value })}
                placeholder="file_import"
              />
            </div>

            <div className="form-group">
              <label>Location (optional)</label>
              <input
                type="text"
                value={fileData.location}
                onChange={(e) => setFileData({ ...fileData, location: e.target.value })}
                placeholder="e.g., Point Pleasant, WV"
              />
            </div>

            <div className="form-group">
              <label>Tags (comma-separated)</label>
              <input
                type="text"
                value={fileData.tags}
                onChange={(e) => setFileData({ ...fileData, tags: e.target.value })}
                placeholder="import, file, data"
              />
            </div>

            <button type="submit" disabled={loading || !fileData.file} className="submit-button">
              {loading ? 'Importing...' : 'Import File'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default DataCollection;

