import axios from 'axios';

// Backend API base URL
// Priority:
// 1. REACT_APP_API_URL environment variable (for local/dev overrides)
// 2. Deployed Render backend URL as default
const API_BASE_URL =
  process.env.REACT_APP_API_URL || 'https://serpicoproject.onrender.com/api/v1';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const adminAPI = {
  // Admin authentication
  login: (username: string, password: string) => 
    api.post('/admin/login', { username, password }),

  // Admin data viewing
  getAllCases: () => api.get('/admin/cases'),
  getAllPerps: () => api.get('/admin/perps'),
  getAllOfficers: () => api.get('/admin/officers'),
  getAllEmergencies: () => api.get('/admin/emergencies'),
  getAllUsers: () => api.get('/admin/users'),

  // Admin data creation
  createCase: (data: any) => api.post('/admin/cases', data),
  createPerp: (data: any) => api.post('/admin/perps', data),
  createOfficer: (data: any) => api.post('/admin/officers', data),
  createEmergency: (data: any) => api.post('/admin/emergencies', data),

  // RAG Management
  getRAGDocuments: () => api.get('/rag/documents'),
  getRAGDocument: (id: string) => api.get(`/rag/documents/${id}`),
  createRAGDocument: (data: {
    title: string;
    content: string;
    category: string;
    location?: string;
    tags: string[];
  }) => api.post('/rag/documents', data),
  updateRAGDocument: (id: string, data: {
    title: string;
    content: string;
    category: string;
    location?: string;
    tags: string[];
  }) => api.put(`/rag/documents/${id}`, data),
  deleteRAGDocument: (id: string) => api.delete(`/rag/documents/${id}`),
};

export default api;

