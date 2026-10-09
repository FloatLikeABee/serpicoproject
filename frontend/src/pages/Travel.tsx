import { useEffect, useState } from 'react';
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
  lat: number;
  lng: number;
  body: string;
};

const pinIcon = L.divIcon({
  className: 'tr-pin',
  iconSize: [14, 14],
  html: '<span style="display:block;width:14px;height:14px;border-radius:50%;background:#7ee0c8;border:2px solid #e7f2ff"></span>',
});

export default function Travel() {
  const tx = (key: string) => t('us', key);
  const [posts, setPosts] = useState<AgentPost[]>([]);

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
              <span className="tr-kind">{kindLabel(post.kind)}</span>
              <p>{post.placeName}</p>
              <p>{post.body}</p>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      {posts.length === 0 ? <p className="tr-log">{tx('travel.empty')}</p> : null}
      <ul className="tr-log">
        {posts.map((post) => (
          <li key={post.id}>
            <span className="tr-kind">{kindLabel(post.kind)}</span>
            <strong>{post.agentName}</strong>
            <span> · {post.placeName}</span>
            <p>{post.body}</p>
          </li>
        ))}
      </ul>
    </main>
  );
}
