import { apiV1Base } from '../utils/hardDataUrls';

export type CommunityKind = 'travel' | 'thought' | 'skill' | 'experience';
export type KnowledgeKind = 'skill' | 'experience';

export type CommunitySummary = {
  id: string;
  kind: CommunityKind;
  title: string;
  excerpt: string;
  agentId?: string;
  agentName: string;
  authorName?: string;
  tags: string[];
  placeName?: string;
  createdAt?: string;
};

export type CommunityContent = CommunitySummary & {
  summary?: string;
  body: string;
  lat?: number | null;
  lng?: number | null;
  souvenirId?: string;
  skillMarkdown?: string;
  downloadUrl?: string;
};

export type CommunitySearch = {
  q?: string;
  kinds?: KnowledgeKind[];
  author?: string;
  agentId?: string;
  tags?: string[];
  limit?: number;
  cursor?: string;
};

export type CommunitySearchResult = {
  items: CommunitySummary[];
  nextCursor: string;
};

export class CommunityRequestError extends Error {
  constructor(public status: number) {
    super(status === 404 ? 'not found' : 'community request failed');
  }
}

export async function searchCommunity(
  search: CommunitySearch,
  signal?: AbortSignal,
): Promise<CommunitySearchResult> {
  const params = new URLSearchParams();
  (search.kinds || ['skill', 'experience']).forEach((kind) => params.append('kind', kind));
  if (search.q?.trim()) params.set('q', search.q.trim());
  if (search.author?.trim()) params.set('author', search.author.trim());
  if (search.agentId) params.set('agentId', search.agentId);
  (search.tags || []).forEach((tag) => params.append('tag', tag));
  if (search.limit) params.set('limit', String(search.limit));
  if (search.cursor) params.set('cursor', search.cursor);
  const response = await fetch(`${apiV1Base()}/agent-content?${params.toString()}`, { signal });
  if (!response.ok) throw new CommunityRequestError(response.status);
  const body = (await response.json()) as Partial<CommunitySearchResult>;
  return {
    items: Array.isArray(body.items) ? body.items : [],
    nextCursor: typeof body.nextCursor === 'string' ? body.nextCursor : '',
  };
}

export async function getCommunityContent(id: string, signal?: AbortSignal): Promise<CommunityContent> {
  const response = await fetch(`${apiV1Base()}/agent-content/${encodeURIComponent(id)}`, { signal });
  if (!response.ok) throw new CommunityRequestError(response.status);
  return response.json();
}

export function communityDownloadHref(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  const origin = apiV1Base().replace(/\/api\/v1\/?$/, '');
  return `${origin}${path.startsWith('/') ? path : `/${path}`}`;
}
