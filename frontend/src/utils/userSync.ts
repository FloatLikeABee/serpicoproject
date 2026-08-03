import api from '../services/api';
import type { MapTag } from './mapTags';
import {
  StoredChatMessage,
  chatSessionsKey,
  chatStoragePrefix,
} from './chatHistory';

export interface ChatSessionMeta {
  id: string;
  title: string;
  lastMessage: string;
  timestamp: string;
  context?: string;
}

export interface ChatSyncPayload {
  entries: Record<string, StoredChatMessage[]>;
  sessions: ChatSessionMeta[];
}

const mapTagPushTimers = new Map<string, ReturnType<typeof setTimeout>>();
const chatPushTimers = new Map<string, ReturnType<typeof setTimeout>>();

function debouncedMapTagPush(userId: string, tags: MapTag[]) {
  const existing = mapTagPushTimers.get(userId);
  if (existing) clearTimeout(existing);
  mapTagPushTimers.set(
    userId,
    setTimeout(() => {
      mapTagPushTimers.delete(userId);
      void api.put('/sync/map-tags', { tags }).catch((err) => {
        console.warn('map tag sync failed', err);
      });
    }, 800)
  );
}

function debouncedChatPush(userId: string, payload: ChatSyncPayload) {
  const existing = chatPushTimers.get(userId);
  if (existing) clearTimeout(existing);
  chatPushTimers.set(
    userId,
    setTimeout(() => {
      chatPushTimers.delete(userId);
      void api.put('/sync/chat', payload).catch((err) => {
        console.warn('chat sync failed', err);
      });
    }, 800)
  );
}

export function collectLocalChatData(userId: string): ChatSyncPayload {
  const prefix = chatStoragePrefix(userId);
  const entries: Record<string, StoredChatMessage[]> = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith(prefix)) continue;
      const suffix = key.slice(prefix.length);
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      try {
        entries[suffix] = JSON.parse(raw) as StoredChatMessage[];
      } catch {
        /* skip corrupt entry */
      }
    }
  } catch {
    /* localStorage unavailable */
  }

  const sessions = readJSON<ChatSessionMeta[]>(chatSessionsKey(userId), []);
  return { entries, sessions };
}

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function applyChatData(userId: string, payload: ChatSyncPayload) {
  const prefix = chatStoragePrefix(userId);
  for (const [suffix, messages] of Object.entries(payload.entries || {})) {
    try {
      localStorage.setItem(`${prefix}${suffix}`, JSON.stringify(messages));
    } catch {
      /* storage full */
    }
  }
  if (payload.sessions?.length) {
    try {
      localStorage.setItem(chatSessionsKey(userId), JSON.stringify(payload.sessions));
    } catch {
      /* storage full */
    }
  }
}

export async function syncMapTagsFromServer(
  userId: string,
  localTags: MapTag[]
): Promise<MapTag[]> {
  if (!userId || userId === 'guest') return localTags;
  try {
    const { data } = await api.get<{ tags: MapTag[] }>('/sync/map-tags', {
      timeout: 12000,
    });
    const remote = Array.isArray(data.tags) ? data.tags : [];
    if (remote.length > 0) {
      return remote;
    }
    if (localTags.length > 0) {
      debouncedMapTagPush(userId, localTags);
    }
    return localTags;
  } catch (err) {
    console.warn('syncMapTagsFromServer failed', err);
    return localTags;
  }
}

export function pushMapTagsToServer(userId: string, tags: MapTag[]) {
  if (!userId || userId === 'guest') return;
  debouncedMapTagPush(userId, tags);
}

export async function syncChatFromServer(userId: string): Promise<ChatSyncPayload | null> {
  if (!userId || userId === 'guest') return null;
  const local = collectLocalChatData(userId);
  try {
    const { data } = await api.get<ChatSyncPayload>('/sync/chat', { timeout: 12000 });
    const remoteEntries = data.entries || {};
    const remoteSessions = data.sessions || [];
    const hasRemote =
      Object.keys(remoteEntries).length > 0 || remoteSessions.length > 0;
    const hasLocal =
      Object.keys(local.entries).length > 0 || local.sessions.length > 0;

    if (hasRemote) {
      applyChatData(userId, {
        entries: remoteEntries,
        sessions: remoteSessions,
      });
      return { entries: remoteEntries, sessions: remoteSessions };
    }
    if (hasLocal) {
      debouncedChatPush(userId, local);
    }
    return local;
  } catch (err) {
    console.warn('syncChatFromServer failed', err);
    return null;
  }
}

export function pushChatToServer(userId: string) {
  if (!userId || userId === 'guest') return;
  debouncedChatPush(userId, collectLocalChatData(userId));
}

export function chatKeyFor(userId: string, context: string, sessionId?: string) {
  const suffix = sessionId ? `${context}:${sessionId}` : context;
  return `${chatStoragePrefix(userId)}${suffix}`;
}

export function loadSyncedSessionMeta(userId: string): ChatSessionMeta[] {
  return readJSON<ChatSessionMeta[]>(chatSessionsKey(userId), []);
}

export function saveSessionMeta(userId: string, sessions: ChatSessionMeta[]) {
  try {
    localStorage.setItem(chatSessionsKey(userId), JSON.stringify(sessions));
  } catch {
    /* ignore */
  }
  pushChatToServer(userId);
}
