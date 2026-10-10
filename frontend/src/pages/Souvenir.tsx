import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { apiV1Base } from '../utils/hardDataUrls';

export default function Souvenir() {
  const { id } = useParams();
  const [html, setHtml] = useState('');

  useEffect(() => {
    if (!id) return undefined;
    let gone = false;
    fetch(`${apiV1Base()}/souvenirs/${id}`)
      .then((res) => (res.ok ? res.json() : { html: '' }))
      .then((body: { html?: string }) => {
        if (!gone) setHtml(body.html || '');
      })
      .catch(() => {
        if (!gone) setHtml('');
      });
    return () => {
      gone = true;
    };
  }, [id]);

  return (
    <main className="sv-page">
      <iframe title="Souvenir" className="sv-frame" sandbox="" srcDoc={html} />
    </main>
  );
}
