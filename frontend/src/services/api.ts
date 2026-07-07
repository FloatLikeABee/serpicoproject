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

export interface PursuitVehicle {
  id: string;
  role: 'police' | 'perp';
  lat: number;
  lng: number;
  heading: number;
  route?: Array<{ lat: number; lng: number }>;
  routeIndex?: number;
  routeProgress?: number;
  maxSpeedMph: number;
  officerName?: string;
  officerRank?: string;
  evaluation?: string;
  vehicleModel?: string;
  pursuingPerpId?: string;
  status: string;
  beingPursued?: boolean;
}

export interface PursuitRoundResult {
  outcome: 'total_failure' | 'partial_win' | 'total_win';
  caught: number;
  escaped: number;
  totalPerps: number;
  score: number;
  message: string;
  grade: string;
  stats?: RoundStats;
}

export interface PursuitDecision {
  policeId: string;
  policeName: string;
  policeSpeed: number;
  policeRank?: string;
  vehicleModel: string;
  perpId: string;
  perpName: string;
  perpSpeed: number;
  perpModel: string;
  timestampMs: number;
  outcome?: string;
}

export interface RoundStats {
  round: number;
  roundDurationSec: number;
  totalPolice: number;
  totalPerps: number;
  policeDown: number;
  policeUsed: number;
  pursuitsLaunched: number;
  caught: number;
  escaped: number;
  outcome: string;
  operationalScore: number;
  decisions: PursuitDecision[];
  policeStatus: Array<{ name: string; status: string; model: string; speed: number; rank?: string }>;
}

export interface PursuitAIEvaluation {
  grade: string;
  score: number;
  summary: string;
  strategyAnalysis: string;
  resourceAnalysis: string;
  strengths: string[];
  improvements: string[];
}

export interface PursuitExamSession {
  id: string;
  userId: string;
  phase: 'active' | 'completed' | 'cooldown';
  round: number;
  roundEndsAt: string;
  cooldownEndsAt?: string;
  vehicles: PursuitVehicle[];
  result?: PursuitRoundResult;
  armedPoliceId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ChatHistoryEntry {
  role: 'user' | 'assistant';
  content: string;
}

export const chatAPI = {
  sendMessage: async (
    message: string,
    context?: string,
    history?: ChatHistoryEntry[]
  ): Promise<ChatResponse> => {
    const response = await api.post<ChatResponse>('/chat', {
      message,
      context: context || '',
      history: history || [],
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

export const pursuitExamAPI = {
  getState: async (userId: string): Promise<{ session: PursuitExamSession }> => {
    const response = await api.get<{ session: PursuitExamSession }>('/pursuit-exam/state', {
      params: { userId },
      headers: { 'X-User-Id': userId },
    });
    return response.data;
  },
  armPursuit: async (userId: string, policeId: string): Promise<{ session: PursuitExamSession }> => {
    const response = await api.post<{ session: PursuitExamSession }>(
      '/pursuit-exam/arm',
      { userId, policeId },
      { headers: { 'X-User-Id': userId } }
    );
    return response.data;
  },
  startPursuit: async (userId: string, policeId: string, perpId: string): Promise<{ session: PursuitExamSession }> => {
    const response = await api.post<{ session: PursuitExamSession }>(
      '/pursuit-exam/pursue',
      { userId, policeId, perpId },
      { headers: { 'X-User-Id': userId } }
    );
    return response.data;
  },
  evaluateRound: async (stats: RoundStats): Promise<{ evaluation: PursuitAIEvaluation }> => {
    const response = await api.post<{ evaluation: PursuitAIEvaluation }>('/pursuit-exam/evaluate', { stats });
    return response.data;
  },
};

export default api;

