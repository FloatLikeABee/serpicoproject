import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminAPI } from '../services/api';
import './RAGTraining.css';

interface RAGDocument {
  id: string;
  title: string;
  content: string;
  category: string;
  location?: string;
  tags: string[];
  summary?: string;
}

const RAGTraining: React.FC = () => {
  const navigate = useNavigate();
  const [documents, setDocuments] = useState<RAGDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingDoc, setEditingDoc] = useState<RAGDocument | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    category: '',
    location: '',
    tags: '',
  });

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      try {
        const summariesResponse = await adminAPI.getRAGSummaries();
        if (summariesResponse.data.summaries && summariesResponse.data.summaries.length > 0) {
          const summaries = summariesResponse.data.summaries;
          setDocuments(summaries.map((s: any) => ({
            id: s.id,
            title: s.title,
            content: s.content_preview || '',
            category: s.category,
            location: s.location,
            tags: s.tags || [],
            summary: s.summary,
          })));
          setLoading(false);
          return;
        }
      } catch {
        // Fall through to full documents
      }

      const response = await adminAPI.getRAGDocuments();
      setDocuments(response.data.documents || []);
    } catch (error) {
      console.error('Failed to fetch RAG documents:', error);
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const tags = formData.tags.split(',').map((t) => t.trim()).filter(Boolean);
      const payload = {
        title: formData.title,
        content: formData.content,
        category: formData.category,
        location: formData.location || undefined,
        tags,
      };

      if (editingDoc) {
        await adminAPI.updateRAGDocument(editingDoc.id, payload);
      } else {
        await adminAPI.createRAGDocument(payload);
      }

      setShowForm(false);
      setEditingDoc(null);
      setFormData({ title: '', content: '', category: '', location: '', tags: '' });
      fetchDocuments();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to save document');
    }
  };

  const handleEdit = (doc: RAGDocument) => {
    setEditingDoc(doc);
    setFormData({
      title: doc.title,
      content: doc.content,
      category: doc.category,
      location: doc.location || '',
      tags: doc.tags.join(', '),
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this document?')) return;
    try {
      await adminAPI.deleteRAGDocument(id);
      fetchDocuments();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to delete document');
    }
  };

  const categories = ['crime_stats', 'locations', 'perps', 'strategy', 'history'];

  if (loading) {
    return (
      <div className="admin-page rag-training">
        <div className="status-message muted">Loading RAG documents…</div>
      </div>
    );
  }

  return (
    <div className="admin-page rag-training">
      <header className="admin-header-bar">
        <button type="button" onClick={() => navigate('/')} className="btn btn-ghost">
          ← Back
        </button>
        <h1 className="neon-title">RAG Training</h1>
        <p className="muted">AI training documents</p>
        <button
          type="button"
          onClick={() => {
            setShowForm(true);
            setEditingDoc(null);
            setFormData({ title: '', content: '', category: '', location: '', tags: '' });
          }}
          className="btn btn-primary add-btn"
        >
          + Add document
        </button>
      </header>

      {showForm && (
        <div
          className="form-overlay"
          onClick={() => {
            setShowForm(false);
            setEditingDoc(null);
          }}
        >
          <div className="form-container admin-panel" onClick={(e) => e.stopPropagation()}>
            <h2>{editingDoc ? 'Edit Document' : 'New Document'}</h2>
            <form onSubmit={handleSubmit}>
              <div className="field">
                <label>Title</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                />
              </div>
              <div className="field">
                <label>Content</label>
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  rows={8}
                  required
                />
              </div>
              <div className="field">
                <label>Category</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  required
                >
                  <option value="">Select category</option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Location (optional)</label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                />
              </div>
              <div className="field">
                <label>Tags (comma-separated)</label>
                <input
                  type="text"
                  value={formData.tags}
                  onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                  placeholder="e.g., cold case, fugitive"
                />
              </div>
              <div className="form-actions">
                <button type="submit" className="btn btn-primary">
                  {editingDoc ? 'Update' : 'Create'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditingDoc(null);
                  }}
                  className="btn btn-ghost"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="documents-list">
        {documents.length === 0 ? (
          <div className="admin-panel status-message muted">No RAG documents yet</div>
        ) : (
          documents.map((doc) => (
            <article key={doc.id} className="document-card admin-panel">
              <div className="document-header">
                <h3>{doc.title}</h3>
                <div className="document-actions">
                  <button type="button" onClick={() => handleEdit(doc)} className="btn btn-ghost">
                    Edit
                  </button>
                  <button type="button" onClick={() => handleDelete(doc.id)} className="btn btn-danger">
                    Delete
                  </button>
                </div>
              </div>
              <div className="document-meta">
                <span className="category">{doc.category}</span>
                {doc.location && <span className="location muted">{doc.location}</span>}
              </div>
              {doc.summary && (
                <div className="document-summary">
                  <strong>Summary</strong>
                  <p>{doc.summary}</p>
                </div>
              )}
              <p className="document-content">{doc.content}</p>
              <div className="document-tags">
                {doc.tags.map((tag, idx) => (
                  <span key={idx} className="tag">{tag}</span>
                ))}
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
};

export default RAGTraining;
