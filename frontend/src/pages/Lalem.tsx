import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { t } from '../i18n/catalog';
import { detectLalemLang, saveLalemLang } from '../utils/lalemLang';
import { apiV1Base } from '../utils/hardDataUrls';
import type { Nation } from '../utils/nation';

const SESSION_KEY = 'serpico.lalem.v1';

const SHAPES = ['sit', 'squat', 'urinal', 'pit', 'vacuum', 'portable'] as const;
const SIZES = ['mini', 'standard', 'long', 'accessible', 'child'] as const;
const CLASSES = ['home', 'public', 'transit', 'palace', 'lab', 'luxury'] as const;
const ERAS = ['ancient', 'roman', 'imperial-cn', 'victorian', 'modern', 'space'] as const;

type Dock = 'toilets' | 'hot' | 'useful';

export type LalemToilet = {
  id: string;
  title: string;
  titleEn: string;
  blurb: string;
  blurbEn: string;
  shape: string;
  size: string;
  class: string;
  era: string;
  region: string;
  imageUrl: string;
  credit: string;
};

export type LalemTrend = {
  kind: string;
  title: string;
  hook: string;
  imageUrl: string;
  chips?: string[];
};

export type LalemVideo = {
  title: string;
  posterUrl: string;
  srcUrl: string;
};

export type LalemDigest = {
  disclaimer?: string;
  trends?: LalemTrend[];
  videos?: LalemVideo[];
  useful?: string[];
};

type SessionSnap = {
  dock?: Dock;
};

function lalemLocale(nation: Nation): string {
  return nation === 'cn' ? 'cn' : 'en';
}

function readDock(): Dock {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return 'toilets';
    const parsed = JSON.parse(raw) as SessionSnap;
    if (parsed?.dock === 'hot' || parsed?.dock === 'useful' || parsed?.dock === 'toilets') {
      return parsed.dock;
    }
  } catch {
    /* ignore */
  }
  return 'toilets';
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function sitMilestone(elapsedSeconds: number): number {
  return Math.floor(Math.max(0, elapsedSeconds) / 300);
}

function sitAlertTier(milestone: number): number {
  if (milestone < 1) return 0;
  return Math.min(6, milestone);
}

export default function Lalem() {
  const [nation, setNation] = useState<Nation>(() => detectLalemLang());
  const [dock, setDock] = useState<Dock>(() => readDock());
  const [toilets, setToilets] = useState<LalemToilet[]>([]);
  const [digest, setDigest] = useState<LalemDigest | null>(null);
  const [shape, setShape] = useState('');
  const [size, setSize] = useState('');
  const [klass, setKlass] = useState('');
  const [era, setEra] = useState('');
  const [open, setOpen] = useState<LalemToilet | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [pageVisible, setPageVisible] = useState(() => (typeof document === 'undefined' ? true : !document.hidden));
  const [sitAlert, setSitAlert] = useState(0);
  const [dismissedSit, setDismissedSit] = useState(0);
  const started = useRef(Date.now());
  const titleId = useId();
  const sitTitleId = useId();
  const tx = useCallback((key: string, vars?: Record<string, string | number>) => t(nation, key, vars), [nation]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.add('ll-world');
    root.classList.remove('synth-world', 'fr-world');
    root.lang = nation === 'cn' ? 'zh-CN' : 'en';
    saveLalemLang(nation);
    return () => {
      root.classList.remove('ll-world');
      root.classList.add('synth-world');
    };
  }, [nation]);

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const onVis = () => setPageVisible(!document.hidden);
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ dock }));
    } catch {
      /* ignore */
    }
  }, [dock]);

  useEffect(() => {
    let gone = false;
    fetch(`${apiV1Base()}/lalem/toilets`)
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((body: { toilets?: LalemToilet[] }) => {
        if (!gone) setToilets(Array.isArray(body?.toilets) ? body.toilets : []);
      })
      .catch(() => {
        if (!gone) setToilets([]);
      });
    return () => {
      gone = true;
    };
  }, []);

  const digestLocale = useRef('');

  useEffect(() => {
    if (dock !== 'hot' && dock !== 'useful') return;
    const loc = lalemLocale(nation);
    if (digestLocale.current === loc) return;
    let gone = false;
    fetch(`${apiV1Base()}/lalem/digest?locale=${loc}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((body: LalemDigest) => {
        if (gone) return;
        digestLocale.current = loc;
        setDigest(body);
      })
      .catch(() => {
        if (!gone) setDigest(null);
      });
    return () => {
      gone = true;
    };
  }, [dock, nation]);

  const elapsed = Math.max(0, Math.floor((nowMs - started.current) / 1000));
  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  const dueSit = sitMilestone(elapsed);

  useEffect(() => {
    if (dueSit < 1 || !pageVisible) return;
    if (dueSit <= dismissedSit) return;
    setSitAlert(dueSit);
  }, [dueSit, pageVisible, dismissedSit]);

  const dismissSit = useCallback(() => {
    setDismissedSit((prev) => Math.max(prev, sitAlert, dueSit));
    setSitAlert(0);
  }, [sitAlert, dueSit]);

  useEffect(() => {
    if (!sitAlert) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismissSit();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sitAlert, dismissSit]);

  const visible = useMemo(() => {
    return toilets.filter((item) => {
      if (shape && item.shape !== shape) return false;
      if (size && item.size !== size) return false;
      if (klass && item.class !== klass) return false;
      if (era && item.era !== era) return false;
      return true;
    });
  }, [toilets, shape, size, klass, era]);

  const toiletName = (item: LalemToilet) => (nation === 'cn' ? item.title : item.titleEn);
  const toiletBlurb = (item: LalemToilet) => (nation === 'cn' ? item.blurb : item.blurbEn);

  return (
    <main className="ll-page">
      <header className="ll-top">
        <div>
          <p className="ll-kicker">{tx('lalem.kicker')}</p>
          <h1>{tx('lalem.title')}</h1>
          <p className="ll-timer">{tx('lalem.timer', { m: String(minutes), s: pad2(seconds) })}</p>
        </div>
        <div className="ll-lang">
          <button type="button" className={nation === 'us' ? 'is-on' : undefined} onClick={() => setNation('us')}>
            {tx('lalem.langEn')}
          </button>
          <button type="button" className={nation === 'cn' ? 'is-on' : undefined} onClick={() => setNation('cn')}>
            {tx('lalem.langZh')}
          </button>
        </div>
      </header>

      {dock === 'toilets' ? (
        <div className="ll-body">
          <div className="ll-filters" role="search">
            <ChipRow
              label={tx('lalem.filter.shape')}
              allLabel={tx('lalem.filter.all')}
              value={shape}
              onChange={setShape}
              options={SHAPES.map((id) => ({ id, label: tx(`lalem.shape.${id}`) }))}
            />
            <ChipRow
              label={tx('lalem.filter.size')}
              allLabel={tx('lalem.filter.all')}
              value={size}
              onChange={setSize}
              options={SIZES.map((id) => ({ id, label: tx(`lalem.size.${id}`) }))}
            />
            <ChipRow
              label={tx('lalem.filter.class')}
              allLabel={tx('lalem.filter.all')}
              value={klass}
              onChange={setKlass}
              options={CLASSES.map((id) => ({ id, label: tx(`lalem.class.${id}`) }))}
            />
            <ChipRow
              label={tx('lalem.filter.era')}
              allLabel={tx('lalem.filter.all')}
              value={era}
              onChange={setEra}
              options={ERAS.map((id) => ({ id, label: tx(`lalem.era.${id}`) }))}
            />
          </div>
          <ul className="ll-gallery">
            {visible.map((item, i) => (
              <li key={item.id}>
                <button type="button" className="ll-card" onClick={() => setOpen(item)}>
                  <img
                    src={item.imageUrl}
                    alt={toiletName(item)}
                    width={320}
                    height={200}
                    {...(i === 0 ? { fetchpriority: 'high' } : {})}
                    loading={i === 0 ? 'eager' : 'lazy'}
                  />
                  <span className="ll-card-title">{toiletName(item)}</span>
                  <span className="ll-card-meta">
                    {tx(`lalem.shape.${item.shape}`)} · {tx(`lalem.era.${item.era}`)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {dock === 'hot' ? (
        <div className="ll-body">
          <ul className="ll-gallery">
            {(digest?.trends || []).map((tr, i) => (
              <li key={`${tr.title}-${i}`}>
                <article className="ll-card ll-trend">
                  <img
                    src={tr.imageUrl}
                    alt=""
                    width={320}
                    height={200}
                    loading={i < 2 ? 'eager' : 'lazy'}
                  />
                  <h2 className="ll-card-title">{tr.title}</h2>
                  <p>{tr.hook}</p>
                </article>
              </li>
            ))}
          </ul>
          <div className="ll-videos">
            {(digest?.videos || []).map((vid) => (
              <figure key={vid.srcUrl} className="ll-video">
                <figcaption>{vid.title}</figcaption>
                <video
                  src={vid.srcUrl}
                  poster={vid.posterUrl}
                  controls
                  muted
                  playsInline
                  loop
                  preload="metadata"
                />
              </figure>
            ))}
          </div>
          {!digest ? <p className="ll-empty">{tx('lalem.hotEmpty')}</p> : null}
        </div>
      ) : null}

      {dock === 'useful' ? (
        <div className="ll-body ll-useful">
          <p className="ll-disclaimer">{digest?.disclaimer || tx('lalem.disclaimer')}</p>
          <ul>
            {(digest?.useful || []).map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
          {!digest ? <p className="ll-empty">{tx('lalem.usefulEmpty')}</p> : null}
        </div>
      ) : null}

      <div className="ll-dock">
        <button type="button" className={dock === 'toilets' ? 'is-on' : undefined} onClick={() => setDock('toilets')}>
          {tx('lalem.dock.toilets')}
        </button>
        <button type="button" className={dock === 'hot' ? 'is-on' : undefined} onClick={() => setDock('hot')}>
          {tx('lalem.dock.hot')}
        </button>
        <button type="button" className={dock === 'useful' ? 'is-on' : undefined} onClick={() => setDock('useful')}>
          {tx('lalem.dock.useful')}
        </button>
      </div>

      {open ? (
        <div className="ll-sheet-backdrop" role="presentation" onClick={() => setOpen(null)}>
          <div
            className="ll-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="ll-sheet-head">
              <h2 id={titleId}>{toiletName(open)}</h2>
              <button type="button" className="ll-sheet-close" aria-label={tx('lalem.close')} onClick={() => setOpen(null)}>
                ×
              </button>
            </div>
            <img src={open.imageUrl} alt="" width={480} height={300} />
            <p className="ll-sheet-meta">
              {open.region} · {tx(`lalem.era.${open.era}`)} · {tx(`lalem.shape.${open.shape}`)}
            </p>
            <p>{toiletBlurb(open)}</p>
            <p className="ll-credit">
              {tx('lalem.credit')}: {open.credit}
            </p>
          </div>
        </div>
      ) : null}

      {sitAlert > 0 ? (
        <div className="ll-sit-alert-backdrop" role="presentation" onClick={dismissSit}>
          <div
            className={`ll-sit-alert ll-sit-alert--t${sitAlertTier(sitAlert)}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby={sitTitleId}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id={sitTitleId}>{tx('lalem.sitAlert.title')}</h2>
            <p>{tx(`lalem.sitAlert.t${sitAlertTier(sitAlert)}`, { m: String(Math.max(minutes, sitAlert * 5)) })}</p>
            <button type="button" className="ll-sit-alert-dismiss" onClick={dismissSit}>
              {tx('lalem.sitAlert.dismiss')}
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function ChipRow({
  label,
  allLabel,
  value,
  onChange,
  options,
}: {
  label: string;
  allLabel: string;
  value: string;
  onChange: (next: string) => void;
  options: { id: string; label: string }[];
}) {
  return (
    <div className="ll-chip-row">
      <span className="ll-chip-label">{label}</span>
      <button
        type="button"
        className={!value ? 'is-on' : undefined}
        aria-pressed={!value}
        onClick={() => onChange('')}
      >
        {allLabel}
      </button>
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          className={value === opt.id ? 'is-on' : undefined}
          aria-pressed={value === opt.id}
          onClick={() => onChange(value === opt.id ? '' : opt.id)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
