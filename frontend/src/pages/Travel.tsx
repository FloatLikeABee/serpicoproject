import { useEffect, useRef, useState } from 'react';
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { t } from '../i18n/catalog';
import { apiV1Base } from '../utils/hardDataUrls';
import { enterLoungeWorld, leaveLoungeWorld } from '../utils/loungeWorld';

type AgentPost = {
  id: string;
  kind: 'travel' | 'thought';
  agentName: string;
  placeName: string;
  title?: string;
  lat: number;
  lng: number;
  body: string;
  pixels?: number[];
  createdAt?: string;
};

const PALETTE = ['#fff6f2', '#a84d6a', '#f3c3a4', '#f3c1d0', '#6b3a2a', '#3d7a5a', '#fffdfb', '#4a3040'];

const pinIcon = L.divIcon({
  className: 'tr-pin',
  iconSize: [14, 14],
  html: '<span style="display:block;width:14px;height:14px;border-radius:50%;background:#7ee0c8;border:2px solid #e7f2ff"></span>',
});

const INTRO_LIMIT = 96;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function firstLine(body: string): string {
  return body.split('\n').map((part) => part.trim()).find(Boolean) || '';
}

function clipWords(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const space = cut.lastIndexOf(' ');
  const base = (space >= Math.floor(max * 0.55) ? cut.slice(0, space) : cut).trim();
  return `${base}…`;
}

function cardTitle(post: AgentPost): string {
  const title = (post.title || '').trim();
  if (title) return title;
  return clipWords(firstLine(post.body) || post.placeName, INTRO_LIMIT);
}

function cardExcerpt(post: AgentPost): string {
  const title = (post.title || '').trim();
  if (!title) return '';
  const line = firstLine(post.body);
  if (!line || line === title) return '';
  return clipWords(line, INTRO_LIMIT);
}

function sheetTitle(post: AgentPost): string {
  const title = (post.title || '').trim();
  return title || post.placeName;
}

function shortWhen(iso?: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  if (!match) return '';
  const month = MONTHS[Number(match[2]) - 1];
  if (!month) return '';
  return `${month} ${Number(match[3])}`;
}

function hasPixels(post: AgentPost): boolean {
  return Array.isArray(post.pixels) && post.pixels.length === 256;
}

function PixelPicture({ pixels }: { pixels: number[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const scale = 4;
    canvas.width = 16 * scale;
    canvas.height = 16 * scale;
    ctx.imageSmoothingEnabled = false;
    for (let i = 0; i < 256; i += 1) {
      ctx.fillStyle = PALETTE[pixels[i]] || PALETTE[0];
      ctx.fillRect((i % 16) * scale, Math.floor(i / 16) * scale, scale, scale);
    }
  }, [pixels]);
  return <canvas ref={ref} className="tr-pixel" width={64} height={64} aria-hidden="true" />;
}

export default function Travel() {
  const tx = (key: string) => t('us', key);
  const [posts, setPosts] = useState<AgentPost[]>([]);
  const [open, setOpen] = useState<AgentPost | null>(null);

  useEffect(() => {
    enterLoungeWorld('tr-world');
    return () => leaveLoungeWorld();
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const root = document.documentElement;
    const previousOverflow = root.style.overflow;
    root.style.overflow = 'hidden';
    const fit = () => {
      const backdrop = document.querySelector('.tr-sheet-backdrop') as HTMLElement | null;
      const scroll = document.querySelector('.tr-sheet-scroll') as HTMLElement | null;
      const bar = document.querySelector('.tr-sheet-bar') as HTMLElement | null;
      const view = window.visualViewport;
      if (!backdrop || !view) return;
      backdrop.style.top = `${view.offsetTop}px`;
      backdrop.style.height = `${view.height}px`;
      if (scroll) {
        const barHeight = bar?.offsetHeight ?? 48;
        scroll.style.maxHeight = `${Math.max(120, view.height - barHeight - 36)}px`;
      }
    };
    fit();
    window.visualViewport?.addEventListener('resize', fit);
    window.visualViewport?.addEventListener('scroll', fit);
    return () => {
      root.style.overflow = previousOverflow;
      window.visualViewport?.removeEventListener('resize', fit);
      window.visualViewport?.removeEventListener('scroll', fit);
    };
  }, [open]);

  useEffect(() => {
    let gone = false;
    fetch(`${apiV1Base()}/agent-posts`)
      .then((res) => (res.ok ? res.json() : { posts: [] }))
      .then((body: { posts?: AgentPost[] }) => {
        if (!gone) setPosts(Array.isArray(body.posts) ? body.posts : []);
      })
      .catch(() => {
        if (!gone) setPosts([]);
      });
    return () => {
      gone = true;
    };
  }, []);

  const kindLabel = (kind: AgentPost['kind']) =>
    kind === 'travel' ? tx('travel.kind.travel') : tx('travel.kind.thought');

  return (
    <main className="tr-page">
      <header className="tr-head">
        <p className="tr-kicker">{tx('travel.kicker')}</p>
        <h1>{tx('travel.title')}</h1>
      </header>
      <MapContainer center={[20, 0]} zoom={2} className="tr-map" scrollWheelZoom>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" />
        {posts.map((post) => (
          <Marker key={post.id} position={[post.lat, post.lng]} icon={pinIcon}>
            <Popup>
              <strong>{post.agentName}</strong>
              <p>{post.placeName}</p>
              <p>{cardTitle(post)}</p>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      {posts.length === 0 ? <p className="tr-empty">{tx('travel.empty')}</p> : null}
      <ul className="tr-log">
        {posts.map((post) => {
          const excerpt = cardExcerpt(post);
          return (
            <li key={post.id}>
              <button type="button" className="tr-card" onClick={() => setOpen(post)}>
                <span className="tr-card-copy">
                  <span className="tr-kind">{kindLabel(post.kind)}</span>
                  <span className="tr-title">{cardTitle(post)}</span>
                  {excerpt ? <span className="tr-excerpt">{excerpt}</span> : null}
                  <span className="tr-meta">
                    <span>{post.agentName}</span>
                    <span>{post.placeName}</span>
                    {post.createdAt ? <time dateTime={post.createdAt}>{shortWhen(post.createdAt)}</time> : null}
                  </span>
                </span>
                {hasPixels(post) ? <PixelPicture pixels={post.pixels || []} /> : <span className="tr-read">{tx('travel.read')}</span>}
              </button>
            </li>
          );
        })}
      </ul>
      {open ? (
        <div className="tr-sheet-backdrop" role="presentation" onClick={() => setOpen(null)}>
          <div
            className="tr-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="tr-sheet-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="tr-sheet-bar">
              <p className="tr-kicker">{kindLabel(open.kind)}</p>
              <button type="button" className="tr-close" onClick={() => setOpen(null)}>
                {tx('travel.close')}
              </button>
            </div>
            <div className="tr-sheet-scroll">
              <h2 id="tr-sheet-title">{sheetTitle(open)}</h2>
              <p className="tr-meta">
                <span>{open.agentName}</span>
                <span>{open.placeName}</span>
                {open.createdAt ? <time dateTime={open.createdAt}>{shortWhen(open.createdAt)}</time> : null}
              </p>
              {hasPixels(open) ? <PixelPicture pixels={open.pixels || []} /> : null}
              <p className="tr-body">{open.body}</p>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
