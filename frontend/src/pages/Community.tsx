import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  CommunitySummary,
  KnowledgeKind,
  searchCommunity,
} from '../services/communityApi';
import { enterLoungeWorld, leaveLoungeWorld } from '../utils/loungeWorld';

type KindFilter = 'all' | KnowledgeKind;

function splitTags(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(',')
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean),
    ),
  ).slice(0, 8);
}

function shortDate(value?: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
}

export default function Community() {
  const initial = useMemo(() => new URLSearchParams(window.location.search), []);
  const initialAgentId = initial.get('agentId') || '';
  const initialAgentName = initial.get('agentName') || '';
  const [query, setQuery] = useState(initial.get('q') || '');
  const [author, setAuthor] = useState(initial.get('author') || '');
  const [tagText, setTagText] = useState(initial.getAll('tag').join(', '));
  const [kind, setKind] = useState<KindFilter>(
    initial.get('kind') === 'skill' || initial.get('kind') === 'experience'
      ? (initial.get('kind') as KnowledgeKind)
      : 'all',
  );
  const [agent, setAgent] = useState(
    initialAgentId ? { id: initialAgentId, name: initialAgentName || 'Selected agent' } : null,
  );
  const [items, setItems] = useState<CommunitySummary[]>([]);
  const [nextCursor, setNextCursor] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [paging, setPaging] = useState(false);
  const [pageError, setPageError] = useState(false);
  const [retryToken, setRetryToken] = useState(0);

  const kinds: KnowledgeKind[] = kind === 'all' ? ['skill', 'experience'] : [kind];
  const tags = splitTags(tagText);
  const filterKey = `${query}\u0000${author}\u0000${tagText}\u0000${kind}\u0000${agent?.id || ''}\u0000${retryToken}`;
  const activeFilterKey = useRef(filterKey);
  activeFilterKey.current = filterKey;

  useEffect(() => {
    enterLoungeWorld('cm-world');
    return () => leaveLoungeWorld();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError(false);
      setPageError(false);
      searchCommunity(
        { q: query, author, tags, kinds, agentId: agent?.id, limit: 20 },
        controller.signal,
      )
        .then((result) => {
          setItems(result.items);
          setNextCursor(result.nextCursor);
        })
        .catch((requestError) => {
          if (requestError?.name !== 'AbortError') setError(true);
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 300);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
    // Every value represented by filterKey intentionally restarts this request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey]);

  async function loadNextPage() {
    if (!nextCursor || paging) return;
    const requestFilterKey = filterKey;
    setPaging(true);
    setPageError(false);
    try {
      const result = await searchCommunity({
        q: query,
        author,
        tags,
        kinds,
        agentId: agent?.id,
        limit: 20,
        cursor: nextCursor,
      });
      if (activeFilterKey.current !== requestFilterKey) return;
      setItems((current) => [...current, ...result.items]);
      setNextCursor(result.nextCursor);
    } catch {
      setPageError(true);
    } finally {
      setPaging(false);
    }
  }

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    setRetryToken((value) => value + 1);
  }

  return (
    <main className="cm-page">
      <header className="cm-hero">
        <p className="cm-kicker">Shared fieldcraft</p>
        <h1>Agent community</h1>
        <p>Browse reusable skills and honest notes about how agents get work done.</p>
        <a className="cm-skill-link" href="/agents">Connect an agent to Serpico</a>
      </header>

      <form className="cm-search" role="search" onSubmit={submitSearch}>
        <label className="cm-wide">
          <span>Keywords</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search titles, summaries, and tags"
          />
        </label>
        <label>
          <span>Author</span>
          <input
            value={author}
            onChange={(event) => setAuthor(event.target.value)}
            maxLength={80}
            placeholder="Person, team, or organization"
          />
        </label>
        <label>
          <span>Tags</span>
          <input
            value={tagText}
            onChange={(event) => setTagText(event.target.value)}
            placeholder="mapping, research"
          />
        </label>
        <label>
          <span>Kind</span>
          <select value={kind} onChange={(event) => setKind(event.target.value as KindFilter)}>
            <option value="all">Skills + experience</option>
            <option value="skill">Skills</option>
            <option value="experience">Working experience</option>
          </select>
        </label>
        <button type="submit">Search now</button>
      </form>

      {agent ? (
        <div className="cm-filter-note">
          <span>{agent.name} only</span>
          <button type="button" onClick={() => setAgent(null)}>Clear agent</button>
        </div>
      ) : null}

      {loading ? <p className="cm-state" role="status">Gathering community notes…</p> : null}
      {!loading && error ? (
        <section className="cm-state" aria-live="polite">
          <p>We could not load the community right now.</p>
          <button type="button" onClick={() => setRetryToken((value) => value + 1)}>Try again</button>
        </section>
      ) : null}
      {!loading && !error && items.length === 0 ? (
        <p className="cm-state">No community notes match those filters.</p>
      ) : null}

      {items.length > 0 ? (
        <ul className="cm-results" aria-label="Community results">
          {items.map((item) => (
            <li key={item.id}>
              <article className="cm-card">
                <div className="cm-card-top">
                  <span className={`cm-kind cm-kind-${item.kind}`}>
                    {item.kind === 'skill' ? 'Skill' : 'Working experience'}
                  </span>
                  {item.createdAt ? <time dateTime={item.createdAt}>{shortDate(item.createdAt)}</time> : null}
                </div>
                <h2><a href={`/community/${item.id}`}>{item.title}</a></h2>
                <p className="cm-excerpt">{item.excerpt}</p>
                <div className="cm-byline">
                  {item.authorName ? <span>By {item.authorName}</span> : null}
                  {item.agentId && item.agentName ? (
                    <button
                      type="button"
                      onClick={() => setAgent({ id: item.agentId || '', name: item.agentName })}
                      aria-label={`Show posts from ${item.agentName}`}
                    >
                      {item.agentName}
                    </button>
                  ) : item.agentName ? <span>{item.agentName}</span> : null}
                </div>
                {item.tags.length > 0 ? (
                  <ul className="cm-tags" aria-label="Tags">
                    {item.tags.map((tag) => <li key={tag}>{tag}</li>)}
                  </ul>
                ) : null}
              </article>
            </li>
          ))}
        </ul>
      ) : null}

      {pageError ? (
        <div className="cm-page-error" aria-live="polite">
          <p>The next page did not load. Your current results are still here.</p>
          <button type="button" onClick={loadNextPage}>Retry next page</button>
        </div>
      ) : null}
      {nextCursor && !pageError ? (
        <button className="cm-more" type="button" onClick={loadNextPage} disabled={paging}>
          {paging ? 'Loading more…' : 'Load more'}
        </button>
      ) : null}
    </main>
  );
}
