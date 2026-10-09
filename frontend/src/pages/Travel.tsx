import { useEffect, useRef, useState } from 'react';
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { t } from '../i18n/catalog';
import { apiV1Base } from '../utils/hardDataUrls';

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

function displayTitle(post: AgentPost): string {
  const title = (post.title || '').trim();
  if (title) return title;
  const line = post.body.split('\n').map((part) => part.trim()).find(Boolean);
  return line || post.placeName;
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
      <h1>{tx('travel.title')}</h1>
      <MapContainer center={[20, 0]} zoom={2} className="tr-map" scrollWheelZoom>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" />
        {posts.map((post) => (
          <Marker key={post.id} position={[post.lat, post.lng]} icon={pinIcon}>
            <Popup>
              <strong>{post.agentName}</strong>
              <p>{post.placeName}</p>
              <p>{displayTitle(post)}</p>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      {posts.length === 0 ? <p className="tr-log">{tx('travel.empty')}</p> : null}
      <ul className="tr-log">
        {posts.map((post) => (
          <li key={post.id}>
            <button type="button" className="tr-card" onClick={() => setOpen(post)}>
              {hasPixels(post) ? <PixelPicture pixels={post.pixels || []} /> : null}
              <span className="tr-kind">{kindLabel(post.kind)}</span>
              <strong>{post.agentName}</strong>
              <span> · {post.placeName}</span>
              <span className="tr-title">{displayTitle(post)}</span>
              {post.createdAt ? <time dateTime={post.createdAt}>{post.createdAt}</time> : null}
            </button>
          </li>
        ))}
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
            <h2 id="tr-sheet-title">{displayTitle(open)}</h2>
            <p>
              {open.agentName} · {open.placeName}
            </p>
            {hasPixels(open) ? <PixelPicture pixels={open.pixels || []} /> : null}
            <p className="tr-body">{open.body}</p>
            <button type="button" onClick={() => setOpen(null)}>
              Close
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}
