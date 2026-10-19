import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useParams } from 'react-router-dom';
import {
  CommunityContent,
  CommunityRequestError,
  communityDownloadHref,
  getCommunityContent,
} from '../services/communityApi';
import { enterLoungeWorld, leaveLoungeWorld } from '../utils/loungeWorld';

function longDate(value?: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en', { dateStyle: 'long' }).format(date);
}

export default function CommunityDetail() {
  const { id = '' } = useParams();
  const [content, setContent] = useState<CommunityContent | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error' | 'not-found'>('loading');
  const [retryToken, setRetryToken] = useState(0);
  const [copyMessage, setCopyMessage] = useState('');

  useEffect(() => {
    enterLoungeWorld('cm-world');
    return () => leaveLoungeWorld();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setState('loading');
    getCommunityContent(id, controller.signal)
      .then((result) => {
        setContent(result);
        setState('ready');
      })
      .catch((error) => {
        if (error?.name === 'AbortError') return;
        setState(error instanceof CommunityRequestError && error.status === 404 ? 'not-found' : 'error');
      });
    return () => controller.abort();
  }, [id, retryToken]);

  async function copySkill() {
    if (!content?.skillMarkdown) return;
    try {
      await navigator.clipboard.writeText(content.skillMarkdown);
      setCopyMessage('Copied SKILL.md');
    } catch {
      setCopyMessage('Could not copy SKILL.md');
    }
  }

  if (state === 'loading') {
    return <main className="cm-page cm-detail"><p className="cm-state" role="status">Opening community note…</p></main>;
  }

  if (state === 'not-found') {
    return (
      <main className="cm-page cm-detail">
        <p className="cm-kicker">Shared fieldcraft</p>
        <h1>Community note not found</h1>
        <p>This page may have aged out of the public exchange.</p>
        <a className="cm-back" href="/community">Back to community</a>
      </main>
    );
  }

  if (state === 'error' || !content) {
    return (
      <main className="cm-page cm-detail">
        <p className="cm-kicker">Shared fieldcraft</p>
        <h1>Could not open this note</h1>
        <p>The community service did not answer. You can try the same page again.</p>
        <button type="button" onClick={() => setRetryToken((value) => value + 1)}>Try again</button>
        <a className="cm-back" href="/community">Back to community</a>
      </main>
    );
  }

  const agentHref = content.agentId
    ? `/community?agentId=${encodeURIComponent(content.agentId)}&agentName=${encodeURIComponent(content.agentName)}`
    : '';

  return (
    <main className="cm-page cm-detail">
      <a className="cm-back" href="/community">Back to community</a>
      <article>
        <header className="cm-detail-head">
          <span className={`cm-kind cm-kind-${content.kind}`}>
            {content.kind === 'skill' ? 'Skill' : 'Working experience'}
          </span>
          <h1>{content.title}</h1>
          {content.summary ? <p className="cm-detail-summary">{content.summary}</p> : null}
          <div className="cm-detail-meta">
            {content.authorName ? <span>By {content.authorName}</span> : null}
            {agentHref ? <a href={agentHref}>{content.agentName}</a> : <span>{content.agentName}</span>}
            {content.createdAt ? <time dateTime={content.createdAt}>{longDate(content.createdAt)}</time> : null}
          </div>
          {(content.tags || []).length > 0 ? (
            <ul className="cm-tags" aria-label="Tags">
              {content.tags.map((tag) => <li key={tag}>{tag}</li>)}
            </ul>
          ) : null}
          {content.kind === 'skill' && content.skillMarkdown && content.downloadUrl ? (
            <div className="cm-actions">
              <button type="button" onClick={copySkill}>Copy SKILL.md</button>
              <a href={communityDownloadHref(content.downloadUrl)}>Download SKILL.md</a>
              <span role="status" aria-live="polite">{copyMessage}</span>
            </div>
          ) : null}
        </header>
        <div className="cm-markdown">
          <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml>{content.body}</ReactMarkdown>
        </div>
      </article>
    </main>
  );
}
