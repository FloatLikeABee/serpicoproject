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
      const response = await adminAPI.getRAGDocuments();
      setDocuments(response.data.documents || []);
    } catch (error: any) {
      console.error('Failed to fetch documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const tags = formData.tags.split(',').map(t => t.trim()).filter(t => t);
      const data = {
        title: formData.title,
        content: formData.content,
        category: formData.category,
        location: formData.location || undefined,
        tags,
      };

      if (editingDoc) {
        await adminAPI.updateRAGDocument(editingDoc.id, data);
      } else {
        await adminAPI.createRAGDocument(data);
      }

      setShowForm(false);
      setEditingDoc(null);
      setFormData({ title: '', content: '', category: '', location: '', tags: '' });
      fetchDocuments();
    } catch (error: any) {
      console.error('Failed to save document:', error);
      alert('Failed to save document: ' + (error.response?.data?.error || error.message));
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
    if (!window.confirm('Are you sure you want to delete this document?')) {
      return;
    }
    try {
      await adminAPI.deleteRAGDocument(id);
      fetchDocuments();
    } catch (error: any) {
      console.error('Failed to delete document:', error);
      alert('Failed to delete document: ' + (error.response?.data?.error || error.message));
    }
  };

  const categories = ['crime_stats', 'locations', 'perps', 'strategy', 'history'];

  if (loading) {
    return (
      <div className="rag-training">
        <div className="loading">Loading RAG documents...</div>
      </div>
    );
  }

  return (
    <div className="rag-training">
      <header className="rag-header">
        <button onClick={() => navigate('/')} className="back-button">
          ← Back to Dashboard
        </button>
        <h1>RAG Data Training</h1>
        <p>Format and manage RAG documents for AI training</p>
        <button onClick={() => { setShowForm(true); setEditingDoc(null); setFormData({ title: '', content: '', category: '', location: '', tags: '' }); }} className="add-button">
          + Add New Document
        </button>
      </header>

      {showForm && (
        <div className="form-overlay">
          <div className="form-container">
            <h2>{editingDoc ? 'Edit Document' : 'Create New Document'}</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Title</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Content</label>
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  rows={10}
                  required
                />
              </div>
              <div className="form-group">
                <label>Category</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  required
                >
                  <option value="">Select category</option>
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Location (optional)</label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="e.g., Olathe, KS"
                />
              </div>
              <div className="form-group">
                <label>Tags (comma-separated)</label>
                <input
                  type="text"
                  value={formData.tags}
                  onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                  placeholder="e.g., crime, statistics, olathe"
                />
              </div>
              <div className="form-actions">
                <button type="submit" className="save-button">
                  {editingDoc ? 'Update' : 'Create'} Document
                </button>
                <button type="button" onClick={() => { setShowForm(false); setEditingDoc(null); }} className="cancel-button">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="documents-list">
        {documents.length === 0 ? (
          <div className="no-data">No RAG documents found. Create your first document!</div>
        ) : (
          documents.map((doc) => (
            <div key={doc.id} className="document-card">
              <div className="document-header">
                <h3>{doc.title}</h3>
                <div className="document-actions">
                  <button onClick={() => handleEdit(doc)} className="edit-button">Edit</button>
                  <button onClick={() => handleDelete(doc.id)} className="delete-button">Delete</button>
                </div>
              </div>
              <div className="document-meta">
                <span className="category">{doc.category}</span>
                {doc.location && <span className="location">📍 {doc.location}</span>}
              </div>
              <p className="document-content">{doc.content}</p>
              <div className="document-tags">
                {doc.tags.map((tag, idx) => (
                  <span key={idx} className="tag">{tag}</span>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default RAGTraining;

