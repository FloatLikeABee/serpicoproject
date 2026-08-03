import { getChatInitialMessage } from './chatMessages';

export interface StoredChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  context?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  context?: string;
}

function storageKey(userId: string, context: string, sessionId?: string) {
  const base = `serpico-chat:${userId}:${context || 'general'}`;
  return sessionId ? `${base}:${sessionId}` : base;
}

export function chatStoragePrefix(userId: string) {
  return `serpico-chat:${userId}:`;
}

export function chatSessionsKey(userId: string) {
  return `serpico-chat-sessions:${userId}`;
}

export function toStoredMessage(message: ChatMessage): StoredChatMessage {
  return {
    ...message,
    timestamp: message.timestamp.toISOString(),
  };
}

export function fromStoredMessage(stored: StoredChatMessage): ChatMessage {
  return {
    ...stored,
    timestamp: new Date(stored.timestamp),
  };
}

export function createInitialMessages(context?: string): ChatMessage[] {
  return [{
    id: 'welcome',
    role: 'assistant',
    content: getChatInitialMessage(context),
    timestamp: new Date(),
    context,
  }];
}

export function loadChatHistory(userId: string, context: string, sessionId?: string): ChatMessage[] {
  try {
    const raw = localStorage.getItem(storageKey(userId, context, sessionId));
    if (!raw) return createInitialMessages(context);
    const parsed = JSON.parse(raw) as StoredChatMessage[];
    if (!Array.isArray(parsed) || parsed.length === 0) return createInitialMessages(context);
    return parsed.map(fromStoredMessage);
  } catch {
    return createInitialMessages(context);
  }
}

export function saveChatHistory(userId: string, context: string, messages: ChatMessage[], sessionId?: string) {
  try {
    localStorage.setItem(
      storageKey(userId, context, sessionId),
      JSON.stringify(messages.map(toStoredMessage))
    );
    void import('./userSync').then(({ pushChatToServer }) => pushChatToServer(userId));
  } catch {
    /* storage full or unavailable */
  }
}

export function clearChatHistory(userId: string, context: string, sessionId?: string) {
  localStorage.removeItem(storageKey(userId, context, sessionId));
  void import('./userSync').then(({ pushChatToServer }) => pushChatToServer(userId));
}

export function historyForApi(messages: ChatMessage[], limit = 20) {
  return messages
    .filter((m) => m.id !== 'welcome')
    .slice(-limit)
    .map((m) => ({ role: m.role, content: m.content }));
}
