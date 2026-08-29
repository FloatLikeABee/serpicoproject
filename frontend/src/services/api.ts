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
  reinforcementsLeft?: number;
  clusterCenter?: { lat: number; lng: number };
  createdAt?: string;
  updatedAt?: string;
}

export interface ChatHistoryEntry {
  role: 'user' | 'assistant';
  content: string;
}

async function postWithRetry<T>(fn: () => Promise<T>, attempts = 2): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await fn();
    } catch (err: any) {
      lastErr = err;
      const status = err?.response?.status as number | undefined;
      const retryable =
        !status || status >= 500 || err?.code === 'ECONNABORTED' || err?.code === 'ERR_NETWORK';
      if (!retryable || i === attempts - 1) {
        throw err;
      }
    }
  }
  throw lastErr;
}

export const chatAPI = {
  sendMessage: async (
    message: string,
    context?: string,
    history?: ChatHistoryEntry[],
    opts?: { nation?: string; userId?: string }
  ): Promise<ChatResponse> => {
    const nation = opts?.nation || 'us';
    return postWithRetry(async () => {
      const response = await api.post<ChatResponse>(
        '/chat',
        {
          message,
          context: context || '',
          history: history || [],
          nation,
        },
        { params: { nation, userId: opts?.userId }, timeout: 90000 }
      );
      return response.data;
    });
  },
};

export const usersAPI = {
  getMe: async (userId: string): Promise<{ user: { id: string; nation?: string } }> => {
    const response = await api.get<{ user: { id: string; nation?: string } }>('/users/me', {
      params: { userId: userId || 'guest' },
      timeout: 15000,
    });
    return response.data;
  },
  upsertNation: async (userId: string, nation: string): Promise<void> => {
    await api.put(
      '/users/me',
      { nation },
      { params: { userId: userId || 'guest' }, timeout: 15000 }
    );
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

export interface InvestigationHelperSession {
  id: string;
  userId: string;
  title: string;
  summary: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface InvestigationHelperMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | string;
  content: string;
  createdAt: string;
}

export interface InvestigationHelperFile {
  id: string;
  sessionId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  url: string;
  createdAt: string;
}

export type InvestigationHelperPayload = {
  session: InvestigationHelperSession;
  messages: InvestigationHelperMessage[];
  files: InvestigationHelperFile[];
};

const helperParams = (userId: string, nation?: string) => ({
  userId: userId || 'guest',
  ...(nation ? { nation } : {}),
});

export const investigationHelperAPI = {
  listSessions: async (userId: string): Promise<{ sessions: InvestigationHelperSession[] }> => {
    const response = await api.get<{ sessions: InvestigationHelperSession[] }>(
      '/investigation-helper/sessions',
      { params: helperParams(userId), timeout: 15000 }
    );
    return response.data;
  },
  createSession: async (
    userId: string,
    payload?: { title?: string; summary?: string; notes?: string }
  ): Promise<InvestigationHelperPayload> => {
    const response = await api.post<InvestigationHelperPayload>(
      '/investigation-helper/sessions',
      payload || {},
      { params: helperParams(userId), timeout: 20000 }
    );
    return response.data;
  },
  getSession: async (userId: string, sessionId: string): Promise<InvestigationHelperPayload> => {
    const response = await api.get<InvestigationHelperPayload>(
      `/investigation-helper/sessions/${sessionId}`,
      { params: helperParams(userId) }
    );
    return response.data;
  },
  updateSession: async (
    userId: string,
    sessionId: string,
    payload: { title?: string; summary?: string; notes?: string }
  ): Promise<InvestigationHelperPayload> => {
    const response = await api.put<InvestigationHelperPayload>(
      `/investigation-helper/sessions/${sessionId}`,
      payload,
      { params: helperParams(userId) }
    );
    return response.data;
  },
  deleteSession: async (userId: string, sessionId: string): Promise<void> => {
    await api.delete(`/investigation-helper/sessions/${sessionId}`, {
      params: helperParams(userId),
    });
  },
  uploadFile: async (
    userId: string,
    sessionId: string,
    file: File
  ): Promise<{ file: InvestigationHelperFile }> => {
    const form = new FormData();
    form.append('file', file);
    const response = await api.post<{ file: InvestigationHelperFile }>(
      `/investigation-helper/sessions/${sessionId}/uploads`,
      form,
      {
        params: helperParams(userId),
        timeout: 60000,
      }
    );
    return response.data;
  },
  deleteFile: async (userId: string, sessionId: string, fileId: string): Promise<void> => {
    await api.delete(`/investigation-helper/sessions/${sessionId}/files/${fileId}`, {
      params: helperParams(userId),
    });
  },
  chat: async (
    userId: string,
    sessionId: string,
    message: string,
    nation?: string
  ): Promise<InvestigationHelperPayload> => {
    return postWithRetry(async () => {
      const response = await api.post<InvestigationHelperPayload>(
        `/investigation-helper/sessions/${sessionId}/chat`,
        { message },
        { params: helperParams(userId, nation), timeout: 90000 }
      );
      return response.data;
    });
  },
  fileUrl: (relativeUrl: string, userId?: string) => {
    if (!relativeUrl) return '';
    if (relativeUrl.startsWith('http')) {
      if (!userId) return relativeUrl;
      const join = relativeUrl.includes('?') ? '&' : '?';
      return `${relativeUrl}${join}userId=${encodeURIComponent(userId)}`;
    }
    const base = API_BASE_URL.replace(/\/api\/v1\/?$/, '');
    const path = `${base}${relativeUrl.startsWith('/') ? '' : '/'}${relativeUrl}`;
    if (!userId) return path;
    return `${path}?userId=${encodeURIComponent(userId)}`;
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
  deployPolice: async (
    userId: string,
    lat: number,
    lng: number
  ): Promise<{ session: PursuitExamSession }> => {
    const response = await api.post<{ session: PursuitExamSession }>(
      '/pursuit-exam/deploy',
      { userId, lat, lng },
      { headers: { 'X-User-Id': userId } }
    );
    return response.data;
  },
  evaluateRound: async (stats: RoundStats): Promise<{ evaluation: PursuitAIEvaluation }> => {
    const response = await api.post<{ evaluation: PursuitAIEvaluation }>('/pursuit-exam/evaluate', { stats });
    return response.data;
  },
  evaluateLocationTactics: async (
    stats: Record<string, unknown>
  ): Promise<{ evaluation: PursuitAIEvaluation }> => {
    const response = await api.post<{ evaluation: PursuitAIEvaluation }>(
      '/pursuit-exam/location-evaluate',
      { stats }
    );
    return response.data;
  },
};

export type MysteryCaseCategory = 'missing_person' | 'cold_case' | 'unsolved_crime' | 'fugitive' | string;

export interface MysteryCase {
  id: string;
  title: string;
  category: MysteryCaseCategory;
  location: string;
  date: string;
  summary: string;
  status: string;
  sourceUrl: string;
  sourceName: string;
  lastUpdate: string;
  createdAt: string;
  updatedAt: string;
}

export interface MysteryBriefing {
  id: string;
  title: string;
  bodyMd: string;
  sources: string[];
  createdAt: string;
}

export interface MysteryInsight {
  id: string;
  authorName: string;
  title: string;
  body: string;
  category: string;
  factCheckStatus: string;
  factCheckNotes: string;
  createdAt: string;
}

export interface MysteriesStatus {
  caseCount: number;
  insightCount: number;
  briefingCount: number;
  casesLastRefresh: string;
  briefingLastRefresh: string;
  casesNextRefresh: string;
  briefingNextRefresh: string;
  casesRefreshing: boolean;
  briefingRefreshing: boolean;
}

export const mysteriesAPI = {
  getStatus: async (nation?: string): Promise<MysteriesStatus> => {
    const response = await api.get<MysteriesStatus>('/mysteries/status', { params: { nation } });
    return response.data;
  },
  listCases: async (
    category?: string,
    nation?: string
  ): Promise<{ cases: MysteryCase[]; total: number; status: MysteriesStatus }> => {
    const response = await api.get<{ cases: MysteryCase[]; total: number; status: MysteriesStatus }>(
      '/mysteries/cases',
      { params: { ...(category && category !== 'all' ? { category } : {}), nation } }
    );
    return response.data;
  },
  refreshCases: async (nation?: string): Promise<void> => {
    await api.post('/mysteries/cases/refresh', {}, { params: { nation } });
  },
  listBriefings: async (
    nation?: string
  ): Promise<{
    briefings: MysteryBriefing[];
    latest: MysteryBriefing | null;
    status: MysteriesStatus;
  }> => {
    const response = await api.get<{
      briefings: MysteryBriefing[];
      latest: MysteryBriefing | null;
      status: MysteriesStatus;
    }>('/mysteries/briefings', { params: { nation } });
    return response.data;
  },
  refreshBriefing: async (nation?: string): Promise<void> => {
    await api.post('/mysteries/briefings/refresh', {}, { params: { nation } });
  },
  listInsights: async (nation?: string): Promise<{ insights: MysteryInsight[]; total: number }> => {
    const response = await api.get<{ insights: MysteryInsight[]; total: number }>('/mysteries/insights', {
      params: { nation },
    });
    return response.data;
  },
  submitInsight: async (payload: {
    authorName: string;
    title: string;
    body: string;
    category: string;
  }): Promise<{ insight: MysteryInsight }> => {
    const response = await api.post<{ insight: MysteryInsight }>('/mysteries/insights', payload);
    return response.data;
  },
};

/** Investigation case (parent for timeline nodes). */
export interface InvestigationCase {
  id: string;
  type: string;
  location: string;
  date: string;
  status: string;
  description: string;
  solved: boolean;
  nodeCount?: number;
}

/** Timeline event node under a case — ordered by time. */
export interface InvestigationNode {
  id: string;
  caseId: string;
  authorName: string;
  place: string;
  location: string;
  name: string;
  time: string;
  event: string;
  analysis: string;
  createdAt: string;
  updatedAt: string;
}

export const investigationAPI = {
  listCases: async (): Promise<{ cases: InvestigationCase[] }> => {
    const response = await api.get<{ cases: InvestigationCase[] }>('/cases', {
      // Fail over to local cache quickly instead of hanging on a cold Render wake.
      timeout: 12000,
    });
    return response.data;
  },
  getCase: async (
    caseId: string
  ): Promise<{ case: InvestigationCase; nodes: InvestigationNode[] }> => {
    const response = await api.get<{ case: InvestigationCase; nodes: InvestigationNode[] }>(
      `/cases/${caseId}`
    );
    return response.data;
  },
  createCase: async (payload: {
    type: string;
    location: string;
    date: string;
    description?: string;
  }): Promise<InvestigationCase> => {
    const response = await api.post<InvestigationCase>('/cases', payload);
    return response.data;
  },
  createNode: async (
    caseId: string,
    payload: {
      authorName: string;
      place: string;
      location: string;
      name: string;
      time: string;
      event: string;
      analysis: string;
    }
  ): Promise<{ node: InvestigationNode }> => {
    const response = await api.post<{ node: InvestigationNode }>(`/cases/${caseId}/nodes`, payload);
    return response.data;
  },
  updateNode: async (
    nodeId: string,
    payload: {
      place: string;
      location: string;
      name: string;
      time: string;
      event: string;
      analysis: string;
    }
  ): Promise<{ node: InvestigationNode }> => {
    const response = await api.put<{ node: InvestigationNode }>(`/nodes/${nodeId}`, payload);
    return response.data;
  },
  deleteNode: async (nodeId: string): Promise<void> => {
    await api.delete(`/nodes/${nodeId}`);
  },
  assistNode: async (
    caseId: string,
    payload: {
      place: string;
      location: string;
      name: string;
      time: string;
      event: string;
      analysis: string;
    }
  ): Promise<{ event: string; analysis: string }> => {
    const response = await api.post<{ event: string; analysis: string }>(
      `/cases/${caseId}/nodes/assist`,
      payload
    );
    return response.data;
  },
};

export interface FleetMarkerPayload {
  id: string;
  cityId: string;
  kind: string;
  name: string;
  lat: number;
  lng: number;
  address?: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export const fleetAPI = {
  listMarkers: async (
    userId: string,
    cityId?: string
  ): Promise<{ markers: FleetMarkerPayload[] }> => {
    const response = await api.get<{ markers: FleetMarkerPayload[] }>('/fleet/markers', {
      params: { ...helperParams(userId), ...(cityId ? { cityId } : {}) },
      timeout: 15000,
    });
    return response.data;
  },
  createMarker: async (
    userId: string,
    payload: {
      id?: string;
      cityId: string;
      kind: string;
      name: string;
      lat: number;
      lng: number;
      address?: string;
      notes?: string;
    }
  ): Promise<{ marker: FleetMarkerPayload }> => {
    const response = await api.post<{ marker: FleetMarkerPayload }>('/fleet/markers', payload, {
      params: helperParams(userId),
      timeout: 20000,
    });
    return response.data;
  },
  updateMarker: async (
    userId: string,
    markerId: string,
    payload: {
      cityId?: string;
      kind?: string;
      name?: string;
      lat?: number;
      lng?: number;
      address?: string;
      notes?: string;
    }
  ): Promise<{ marker: FleetMarkerPayload }> => {
    const response = await api.put<{ marker: FleetMarkerPayload }>(
      `/fleet/markers/${markerId}`,
      payload,
      { params: helperParams(userId), timeout: 20000 }
    );
    return response.data;
  },
  deleteMarker: async (userId: string, markerId: string): Promise<void> => {
    await api.delete(`/fleet/markers/${markerId}`, {
      params: helperParams(userId),
      timeout: 15000,
    });
  },
};

export default api;

