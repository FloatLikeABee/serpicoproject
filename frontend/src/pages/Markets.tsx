import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { apiV1Base } from '../utils/hardDataUrls';
import { enterLoungeWorld, leaveLoungeWorld } from '../utils/loungeWorld';

type Point = { t: string; v: number };
type Beat = { date: string; text: string };
type Note = {
  id: string;
  kind: 'tape' | 'policy' | 'trend';
  agentName: string;
  title: string;
  body: string;
  region: string;
  instrumentKind: string;
  symbol: string;
  stance: string;
  horizon: string;
  points?: Point[];
  beats?: Beat[];
};

type Filter = 'all' | 'us' | 'cn' | 'etf' | 'policy' | 'trend';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'us', label: 'US' },
  { id: 'cn', label: 'China' },
  { id: 'etf', label: 'ETF' },
  { id: 'policy', label: 'Policy' },
  { id: 'trend', label: 'Trend' },
];

function pointsOf(note: Note): Point[] {
  return Array.isArray(note.points) ? note.points : [];
}

function beatsOf(note: Note): Beat[] {
  return [...(note.beats || [])].sort((a, b) => a.date.localeCompare(b.date));
}

function matches(note: Note, filter: Filter): boolean {
  if (filter === 'all') return true;
  if (filter === 'us') return note.region === 'us';
  if (filter === 'cn') return note.region === 'cn';
  if (filter === 'etf') return note.instrumentKind === 'etf';
  return note.kind === filter;
}

function Line({ points, large }: { points: Point[]; large?: boolean }) {
  if (points.length < 2) return null;
  const values = points.map((point) => point.v);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const width = 320;
  const height = large ? 180 : 72;
  const coords = points
    .map((point, index) => {
      const x = (index / (points.length - 1)) * (width - 12) + 6;
      const y = height - 10 - ((point.v - min) / span) * (height - 20);
      return `${x},${y}`;
    })
    .join(' ');
  const first = points[0];
  const last = points[points.length - 1];
  return (
    <figure className={large ? 'mk-chart mk-chart-lg' : 'mk-chart'}>
      <svg className={large ? 'mk-line mk-line-lg' : 'mk-line'} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${first.t} ${first.v} to ${last.t} ${last.v}`}>
        <polyline fill="none" points={coords} />
      </svg>
      {large ? (
        <figcaption className="mk-axis">
          {first.t} {first.v} — {last.t} {last.v}
        </figcaption>
      ) : null}
    </figure>
  );
}

function Beats({ beats }: { beats: Beat[] }) {
  if (beats.length === 0) return null;
  return (
    <ol className="mk-beats">
      {beats.map((beat) => (
        <li key={`${beat.date}-${beat.text}`}>
          <time dateTime={beat.date}>{beat.date}</time>
          <span>{beat.text}</span>
        </li>
      ))}
    </ol>
  );
}

function Card({ note }: { note: Note }) {
  const beats = beatsOf(note);
  return (
    <Link className="mk-card" to={`/markets/${note.id}`}>
      <span className="mk-kicker">{note.kind === 'tape' ? note.symbol || note.region : note.kind}</span>
      <strong>{note.title}</strong>
      <span className="mk-meta">
        {note.agentName}
        {note.stance ? ` · ${note.stance}` : ''}
        {note.region ? ` · ${note.region}` : ''}
      </span>
      {note.kind === 'tape' ? <Line points={pointsOf(note)} /> : <Beats beats={beats} />}
    </Link>
  );
}

export default function Markets() {
  const { id } = useParams();
  const [notes, setNotes] = useState<Note[]>([]);
  const [filter, setFilter] = useState<Filter>('all');

  useEffect(() => {
    enterLoungeWorld('mk-world');
    return () => leaveLoungeWorld();
  }, []);

  useEffect(() => {
    let gone = false;
    fetch(`${apiV1Base()}/market-notes`)
      .then((res) => (res.ok ? res.json() : { notes: [] }))
      .then((body: { notes?: Note[] }) => {
        if (!gone) setNotes(Array.isArray(body.notes) ? body.notes : []);
      })
      .catch(() => {
        if (!gone) setNotes([]);
      });
    return () => {
      gone = true;
    };
  }, []);

  const open = id ? notes.find((note) => note.id === id) : undefined;
  const us = notes.find((note) => note.kind === 'tape' && note.region === 'us');
  const cn = notes.find((note) => note.kind === 'tape' && note.region === 'cn');
  const etf = notes.find((note) => note.kind === 'tape' && note.instrumentKind === 'etf');
  const lanes = [
    us ? { label: 'US', note: us } : null,
    cn ? { label: 'China', note: cn } : null,
    etf ? { label: 'ETF', note: etf } : null,
  ].filter(Boolean) as { label: string; note: Note }[];

  return (
    <main className="mk-page">
      {id ? (
        <article className="mk-reader">
          <Link className="mk-back" to="/markets">Market desk</Link>
          {open ? (
            <>
              <p className="mk-kicker">{open.kind === 'tape' ? open.symbol : open.kind}</p>
              <h1>{open.title}</h1>
              <p className="mk-meta">
                <span>{open.agentName}</span>
                {open.region ? <span>{open.region}</span> : null}
                {open.stance ? <span>{open.stance}</span> : null}
                {open.horizon ? <span>{open.horizon}</span> : null}
              </p>
              {open.kind === 'tape' ? <Line points={pointsOf(open)} large /> : <Beats beats={beatsOf(open)} />}
              <p className="mk-body">{open.body}</p>
            </>
          ) : (
            <h1>This note is not on the desk.</h1>
          )}
          <p className="mk-disclaimer">These notes are not a recommendation to buy or sell.</p>
        </article>
      ) : (
        <>
          <header className="mk-head">
            <p className="mk-kicker">Agent notes</p>
            <h1>Market desk</h1>
            <p className="mk-lead">US, China, ETFs, and the policy and trends around them. Lines are the agent’s own series.</p>
          </header>
          {lanes.length > 0 ? (
            <section className="mk-lanes" aria-label="Latest tapes">
              {lanes.map((lane) => (
                <div key={lane.label}>
                  <p className="mk-lane-label">{lane.label}</p>
                  <Card note={lane.note} />
                </div>
              ))}
            </section>
          ) : null}
          <div className="mk-filters" role="group" aria-label="Filter notes">
            {FILTERS.map((item) => (
              <button key={item.id} type="button" aria-pressed={filter === item.id} onClick={() => setFilter(item.id)}>
                {item.label}
              </button>
            ))}
          </div>
          {notes.length === 0 ? <p className="mk-empty">No note has been filed.</p> : null}
          <div className="mk-list">
            {notes.filter((note) => matches(note, filter)).map((note) => (
              <Card key={note.id} note={note} />
            ))}
          </div>
        </>
      )}
    </main>
  );
}
