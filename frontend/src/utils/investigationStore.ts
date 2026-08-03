import type { InvestigationCase, InvestigationNode } from '../services/api';

const casesKey = (userId: string) =>
  `serpico.investigation.cases.v1.${userId || 'guest'}`;
const nodesKey = (userId: string, caseId: string) =>
  `serpico.investigation.nodes.v1.${userId || 'guest'}.${caseId}`;

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJSON(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn('investigationStore write failed', err);
  }
}

export function loadCachedCases(userId: string): InvestigationCase[] {
  return readJSON<InvestigationCase[]>(casesKey(userId), []);
}

export function saveCachedCases(userId: string, cases: InvestigationCase[]) {
  writeJSON(casesKey(userId), cases);
}

export function upsertCachedCase(userId: string, caseRow: InvestigationCase) {
  const list = loadCachedCases(userId).filter((c) => c.id !== caseRow.id);
  list.unshift(caseRow);
  saveCachedCases(userId, list);
}

export function loadCachedNodes(userId: string, caseId: string): InvestigationNode[] {
  return readJSON<InvestigationNode[]>(nodesKey(userId, caseId), []);
}

export function saveCachedNodes(
  userId: string,
  caseId: string,
  nodes: InvestigationNode[]
) {
  writeJSON(nodesKey(userId, caseId), nodes);
  const cases = loadCachedCases(userId).map((c) =>
    c.id === caseId ? { ...c, nodeCount: nodes.length } : c
  );
  saveCachedCases(userId, cases);
}

export function clearCachedCase(userId: string, caseId: string) {
  saveCachedCases(
    userId,
    loadCachedCases(userId).filter((c) => c.id !== caseId)
  );
  try {
    localStorage.removeItem(nodesKey(userId, caseId));
  } catch {
    /* ignore */
  }
}
