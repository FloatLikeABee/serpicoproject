import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useAuth } from './AuthContext';
import { pursuitExamAPI, PursuitAIEvaluation } from '../services/api';
import {
  SimSession,
  armPursuit,
  catchUpSimSession,
  createSimSession,
  isStoredSessionUsable,
  loadSimSessionFromStorage,
  saveSimSessionToStorage,
  simSessionFromAPI,
  startPursuit,
  tickSimSession,
} from '../utils/pursuitSim';

interface PursuitExamContextValue {
  session: SimSession | null;
  useServer: boolean;
  selectedPoliceId: string | null;
  pursueModePoliceId: string | null;
  aiEvaluation: PursuitAIEvaluation | null;
  evalLoading: boolean;
  setSelectedPoliceId: (id: string | null) => void;
  armPursue: (policeId: string) => Promise<void>;
  cancelTargeting: () => void;
  launchPursuit: (policeId: string, perpId: string) => Promise<void>;
  pursueModeRef: React.MutableRefObject<string | null>;
  sessionRef: React.MutableRefObject<SimSession | null>;
}

const PursuitExamContext = createContext<PursuitExamContextValue | null>(null);

export function PursuitExamProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id || 'guest';

  const [session, setSession] = useState<SimSession | null>(null);
  const [selectedPoliceId, setSelectedPoliceId] = useState<string | null>(null);
  const [pursueModePoliceId, setPursueModePoliceId] = useState<string | null>(null);
  const [useServer, setUseServer] = useState(false);
  const [aiEvaluation, setAiEvaluation] = useState<PursuitAIEvaluation | null>(null);
  const [evalLoading, setEvalLoading] = useState(false);

  const sessionRef = useRef<SimSession | null>(null);
  const lastTickRef = useRef<number>(performance.now());
  const pursueModeRef = useRef<string | null>(null);
  const evaluatedRoundRef = useRef<number | null>(null);
  const initUserRef = useRef<string | null>(null);

  useEffect(() => {
    sessionRef.current = session;
    if (session) saveSimSessionToStorage(session);
  }, [session]);

  useEffect(() => {
    pursueModeRef.current = pursueModePoliceId;
  }, [pursueModePoliceId]);

  // Initialize once per user — restore local session or fetch server / create new
  useEffect(() => {
    if (initUserRef.current === userId && sessionRef.current) return;
    initUserRef.current = userId;

    let cancelled = false;

    const init = async () => {
      const stored = loadSimSessionFromStorage(userId);
      if (stored && isStoredSessionUsable(stored)) {
        const caughtUp = catchUpSimSession(stored);
        if (!cancelled) {
          setSession(caughtUp);
          sessionRef.current = caughtUp;
          setUseServer(false);
        }
        return;
      }

      try {
        const { session: raw } = await pursuitExamAPI.getState(userId);
        if (cancelled) return;
        const serverSession = simSessionFromAPI(raw as unknown as Record<string, unknown>);
        if (isStoredSessionUsable(serverSession)) {
          const caughtUp = catchUpSimSession(serverSession);
          setSession(caughtUp);
          sessionRef.current = caughtUp;
          setUseServer(true);
          return;
        }
      } catch {
        /* local sim fallback */
      }

      if (!cancelled) {
        const fresh = createSimSession(userId);
        setSession(fresh);
        sessionRef.current = fresh;
        setUseServer(false);
      }
    };

    init();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Background simulation tick — keeps running when user navigates to other modules
  useEffect(() => {
    let frame: number;
    const loop = (ts: number) => {
      const elapsed = Math.min((ts - lastTickRef.current) / 1000, 0.1);
      lastTickRef.current = ts;
      const cur = sessionRef.current;
      if (cur) {
        if (cur.phase === 'active') {
          const next = tickSimSession(cur, elapsed);
          setSession(next);
          sessionRef.current = next;
        } else if (cur.cooldownEndsAt && Date.now() >= cur.cooldownEndsAt) {
          const next = createSimSession(cur.userId, cur.round + 1);
          setSession(next);
          sessionRef.current = next;
          setSelectedPoliceId(null);
          setPursueModePoliceId(null);
          pursueModeRef.current = null;
          setAiEvaluation(null);
          evaluatedRoundRef.current = null;
        }
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, []);

  // AI evaluation when round completes
  useEffect(() => {
    if (session?.phase !== 'completed' || !session.result?.stats) return;
    if (evaluatedRoundRef.current === session.round) return;
    evaluatedRoundRef.current = session.round;

    const runEval = async () => {
      setEvalLoading(true);
      try {
        const { evaluation } = await pursuitExamAPI.evaluateRound(session.result!.stats!);
        setAiEvaluation(evaluation);
      } catch {
        /* InPursue uses local fallback when aiEvaluation is null */
        setAiEvaluation(null);
      } finally {
        setEvalLoading(false);
      }
    };
    runEval();
  }, [session?.phase, session?.round, session?.result]);

  const armPursueHandler = useCallback(
    async (policeId: string) => {
      if (!sessionRef.current) return;
      pursueModeRef.current = policeId;
      setPursueModePoliceId(policeId);

      let next = armPursuit(sessionRef.current, policeId);
      setSession(next);
      sessionRef.current = next;

      if (useServer) {
        try {
          const { session: raw } = await pursuitExamAPI.armPursuit(userId, policeId);
          next = simSessionFromAPI(raw as unknown as Record<string, unknown>);
          setSession(next);
          sessionRef.current = next;
        } catch {
          setUseServer(false);
        }
      }
    },
    [useServer, userId]
  );

  const cancelTargeting = useCallback(() => {
    setPursueModePoliceId(null);
    pursueModeRef.current = null;
    setSession((s) => (s ? { ...s, armedPoliceId: undefined } : s));
  }, []);

  const launchPursuit = useCallback(
    async (policeId: string, perpId: string) => {
      const cur = sessionRef.current;
      if (!cur || cur.phase !== 'active') return;

      let next = startPursuit(cur, policeId, perpId);
      setSession(next);
      sessionRef.current = next;
      setPursueModePoliceId(null);
      pursueModeRef.current = null;
      setSelectedPoliceId(null);

      if (useServer) {
        try {
          const { session: raw } = await pursuitExamAPI.startPursuit(userId, policeId, perpId);
          next = simSessionFromAPI(raw as unknown as Record<string, unknown>);
          setSession(next);
          sessionRef.current = next;
        } catch {
          setUseServer(false);
        }
      }
    },
    [useServer, userId]
  );

  const value = useMemo(
    () => ({
      session,
      useServer,
      selectedPoliceId,
      pursueModePoliceId,
      aiEvaluation,
      evalLoading,
      setSelectedPoliceId,
      armPursue: armPursueHandler,
      cancelTargeting,
      launchPursuit,
      pursueModeRef,
      sessionRef,
    }),
    [
      session,
      useServer,
      selectedPoliceId,
      pursueModePoliceId,
      aiEvaluation,
      evalLoading,
      armPursueHandler,
      cancelTargeting,
      launchPursuit,
    ]
  );

  return <PursuitExamContext.Provider value={value}>{children}</PursuitExamContext.Provider>;
}

export function usePursuitExam() {
  const ctx = useContext(PursuitExamContext);
  if (!ctx) {
    throw new Error('usePursuitExam must be used within PursuitExamProvider');
  }
  return ctx;
}
