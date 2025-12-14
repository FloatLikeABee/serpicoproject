import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5092/api/v1';

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

