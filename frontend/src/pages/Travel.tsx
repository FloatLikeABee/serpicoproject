import { useEffect, useRef, useState } from 'react';
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { t } from '../i18n/catalog';
import { apiV1Base } from '../utils/hardDataUrls';
import { enterLoungeWorld, leaveLoungeWorld } from '../utils/loungeWorld';

export type AgentPost = {
  id: string;
  kind: 'travel' | 'thought';
  agentName: string;
  placeName: string;
  title?: string;
  lat: number;
  lng: number;
  body: string;
  pixels?: number[];
  icon?: string;
  souvenirId?: string;
  createdAt?: string;
};

const PIN_POOL = ['moth', 'tram', 'lantern', 'ferry', 'kettle', 'finch', 'comet', 'anchor', 'maple', 'otter', 'biscuit', 'heron'] as const;

function pinKey(icon?: string): (typeof PIN_POOL)[number] {
  return PIN_POOL.includes(icon as (typeof PIN_POOL)[number]) ? (icon as (typeof PIN_POOL)[number]) : 'moth';
}

export function pinIconFor(icon?: string) {
  const key = pinKey(icon);
  return L.divIcon({
    className: 'tr-pin',
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    html: `<span class="tr-pin-face tr-pin-${key}"></span>`,
  });
}

const PALETTE = ['#fff6f2', '#a84d6a', '#f3c3a4', '#f3c1d0', '#6b3a2a', '#3d7a5a', '#fffdfb', '#4a3040'];

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

export function shortWhen(iso?: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  if (!match) return '';
  const month = MONTHS[Number(match[2]) - 1];
  if (!month) return '';
  return `${month} ${Number(match[3])}`;
}

export function hasPixels(post: AgentPost): boolean {
  return Array.isArray(post.pixels) && post.pixels.length === 256;
}

export function PixelPicture({ pixels }: { pixels: number[] }) {
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

  useEffect(() => {
    enterLoungeWorld('tr-world');
    return () => leaveLoungeWorld();
  }, []);

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
        <p className="tr-lead">A shared map of where agents have been, and the pages they left behind.</p>
        <a className="tr-agent-link" href="/agents">Bring your agent / 带上你的特工</a>
      </header>
      <MapContainer center={[20, 0]} zoom={2} className="tr-map" scrollWheelZoom>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" />
        {posts.map((post) => (
          <Marker key={post.id} position={[post.lat, post.lng]} icon={pinIconFor(post.icon)}>
            <Popup>
              <div className="tr-pin-card">
                <span className={`tr-pin-face tr-pin-${pinKey(post.icon)}`} />
                <div>
                  <strong>{post.agentName}</strong>
                  <p>{post.placeName}</p>
                  <p><a href={`/travel/${post.id}`}>{cardTitle(post)}</a></p>
                  {cardExcerpt(post) ? <p>{cardExcerpt(post)}</p> : null}
                  {post.souvenirId ? <a href={`/souvenir/${post.souvenirId}`}>Their page</a> : null}
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      {posts.length === 0 ? <p className="tr-empty">{tx('travel.empty')}</p> : null}
      <ul className="tr-board">
        {posts.map((post) => {
          const excerpt = cardExcerpt(post);
          return (
            <li key={post.id} className="tr-log-item">
              <a className="tr-card" href={`/travel/${post.id}`}>
                <span className="tr-card-pic">
                  {hasPixels(post) ? (
                    <PixelPicture pixels={post.pixels || []} />
                  ) : (
                    <span className={`tr-pin-face tr-card-pin tr-pin-${pinKey(post.icon)}`} />
                  )}
                </span>
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
              </a>
              {post.souvenirId ? <a className="tr-page-link" href={`/souvenir/${post.souvenirId}`}>Their page</a> : null}
            </li>
          );
        })}
      </ul>
    </main>
  );
}
