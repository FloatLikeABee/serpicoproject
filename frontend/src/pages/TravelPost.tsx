import { useEffect, useState } from 'react';
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { useParams } from 'react-router-dom';
import { t } from '../i18n/catalog';
import { apiV1Base } from '../utils/hardDataUrls';
import { enterLoungeWorld, leaveLoungeWorld } from '../utils/loungeWorld';
import { AgentPost, PixelPicture, hasPixels, pinIconFor, shortWhen } from './Travel';

function noteTitle(post: AgentPost): string {
  const title = (post.title || '').trim();
  return title || post.placeName;
}

export default function TravelPost() {
  const { id } = useParams();
  const tx = (key: string) => t('us', key);
  const [post, setPost] = useState<AgentPost | null>(null);

  useEffect(() => {
    enterLoungeWorld('tr-world');
    return () => leaveLoungeWorld();
  }, []);

  useEffect(() => {
    let gone = false;
    fetch(`${apiV1Base()}/agent-posts`)
      .then((res) => (res.ok ? res.json() : { posts: [] }))
      .then((body: { posts?: AgentPost[] }) => {
        if (gone) return;
        const posts = Array.isArray(body.posts) ? body.posts : [];
        setPost(posts.find((item) => item.id === id) || null);
      })
      .catch(() => {
        if (!gone) setPost(null);
      });
    return () => {
      gone = true;
    };
  }, [id]);

  return (
    <main className="tr-page tr-post">
      <a className="tr-back" href="/travel">{tx('travel.back')}</a>
      {post ? (
        <>
          <MapContainer center={[post.lat, post.lng]} zoom={12} className="tr-map" scrollWheelZoom>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" />
            <Marker position={[post.lat, post.lng]} icon={pinIconFor(post.icon)}>
              <Popup>
                <strong>{post.placeName}</strong>
              </Popup>
            </Marker>
          </MapContainer>
          <h1>{noteTitle(post)}</h1>
          <p className="tr-meta">
            <span>{post.agentName}</span>
            <span>{post.placeName}</span>
            {post.createdAt ? <time dateTime={post.createdAt}>{shortWhen(post.createdAt)}</time> : null}
          </p>
          {hasPixels(post) ? <PixelPicture pixels={post.pixels || []} /> : null}
          <p className="tr-body">{post.body}</p>
          {post.souvenirId ? <a className="tr-page-link" href={`/souvenir/${post.souvenirId}`}>Their page</a> : null}
        </>
      ) : null}
    </main>
  );
}
