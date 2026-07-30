import type { InvestigationCase, InvestigationNode } from '../services/api';

const CASES_KEY = 'serpico.investigation.cases.v1';
const nodesKey = (caseId: string) => `serpico.investigation.nodes.v1.${caseId}`;

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

export function loadCachedCases(): InvestigationCase[] {
  return readJSON<InvestigationCase[]>(CASES_KEY, []);
}

export function saveCachedCases(cases: InvestigationCase[]) {
  writeJSON(CASES_KEY, cases);
}

export function upsertCachedCase(caseRow: InvestigationCase) {
  const list = loadCachedCases().filter((c) => c.id !== caseRow.id);
  list.unshift(caseRow);
  saveCachedCases(list);
}

export function loadCachedNodes(caseId: string): InvestigationNode[] {
  return readJSON<InvestigationNode[]>(nodesKey(caseId), []);
}

export function saveCachedNodes(caseId: string, nodes: InvestigationNode[]) {
  writeJSON(nodesKey(caseId), nodes);
  // Keep case nodeCount in sync
  const cases = loadCachedCases().map((c) =>
    c.id === caseId ? { ...c, nodeCount: nodes.length } : c
  );
  saveCachedCases(cases);
}

export function clearCachedCase(caseId: string) {
  saveCachedCases(loadCachedCases().filter((c) => c.id !== caseId));
  try {
    localStorage.removeItem(nodesKey(caseId));
  } catch {
    /* ignore */
  }
}
