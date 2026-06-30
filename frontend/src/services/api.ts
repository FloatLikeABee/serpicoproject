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

export interface ChaseScenario {
  title: string;
  setting: string;
  situation: string;
  suspectProfile: string;
  vehiclePhase: string;
  footPhase: string;
  codexReference: string;
  caseStudyRef: string;
  imagePrompt: string;
  openingQuestion: string;
  funHook: string;
}

export interface ChaseTurnResponse {
  narrative: string;
  twist: string;
  question: string;
  hint: string;
  reactionEmoji: string;
  turnLabel: string;
}

export interface ChaseEvaluation {
  score: number;
  maxScore: number;
  rank: string;
  badge: string;
  summary: string;
  strengths: string[];
  improvements: string[];
  codexAlignment: string;
  caseStudyNotes: string;
  funClosing: string;
}

export interface ChaseTurnRecord {
  turn: number;
  question: string;
  answer: string;
  feedback?: string;
}

export interface ChaseGameSession {
  id: string;
  phase: string;
  difficulty: string;
  turn: number;
  maxTurns: number;
  scenario?: ChaseScenario;
  imageUrl?: string;
  currentTurn?: ChaseTurnResponse;
  history: ChaseTurnRecord[];
  evaluation?: ChaseEvaluation;
  createdAt: string;
  updatedAt: string;
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

export const chaseGameAPI = {
  start: async (difficulty: string = 'medium'): Promise<{ session: ChaseGameSession }> => {
    const response = await api.post<{ session: ChaseGameSession }>('/chase-game/start', { difficulty });
    return response.data;
  },
  respond: async (sessionId: string, answer: string): Promise<{ session: ChaseGameSession }> => {
    const response = await api.post<{ session: ChaseGameSession }>(`/chase-game/${sessionId}/respond`, { answer });
    return response.data;
  },
  getSession: async (sessionId: string): Promise<{ session: ChaseGameSession }> => {
    const response = await api.get<{ session: ChaseGameSession }>(`/chase-game/${sessionId}`);
    return response.data;
  },
};

export default api;

