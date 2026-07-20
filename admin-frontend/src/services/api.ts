import axios from 'axios';

const API_BASE_URL =
  process.env.REACT_APP_API_URL || 'https://serpicoproject.onrender.com/api/v1';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const adminAPI = {
  login: (username: string, password: string) =>
    api.post('/admin/login', { username, password }),

  getAllUsers: () => api.get('/admin/users'),

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
  getRAGSummaries: () => api.get('/rag/summaries'),

  collectFromURL: (data: {
    url: string;
    category?: string;
    location?: string;
    tags?: string[];
  }) => api.post('/admin/collection/url', data),
  collectFromAPI: (data: {
    api_config: {
      url: string;
      method: string;
      headers: Record<string, string>;
      query_params: Record<string, string>;
      data_path: string;
    };
    category?: string;
    location?: string;
    tags?: string[];
  }) => api.post('/admin/collection/api', data),
  collectFromFile: (formData: FormData) => api.post('/admin/collection/file', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  }),
};

export default api;
