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

export interface ChatRequest {
  message: string;
  context?: string;
}

export interface ChatResponse {
  response: {
    id: string;
    role: string;
    content: string;
    timestamp: string;
  };
}

export const chatAPI = {
  sendMessage: async (message: string, context?: string): Promise<ChatResponse> => {
    const response = await api.post<ChatResponse>('/chat', {
      message,
      context: context || '',
    });
    return response.data;
  },
};

export default api;

