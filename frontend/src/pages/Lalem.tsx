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

type Dock = 'toilets' | 'paper' | 'medicine' | 'hot' | 'useful';

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
  wikiUrlZh?: string;
  wikiUrlEn?: string;
  credit: string;
};

export type LalemPaper = {
  id: string;
  title: string;
  titleEn: string;
  blurb: string;
  blurbEn: string;
  era: string;
  imageUrl: string;
  wikiUrlZh?: string;
  wikiUrlEn?: string;
  credit: string;
};

export type LalemMedicineSource = { label: string; url: string };

export type LalemMedicine = {
  id: string;
  title: string;
  titleEn: string;
  body: string;
  bodyEn: string;
  sources?: LalemMedicineSource[];
};

export type LalemTrend = {
  kind: string;
  title: string;
  hook: string;
  imageUrl: string;
  chips?: string[];
  topicId?: string;
};

export type LalemDigest = {
  disclaimer?: string;
  trends?: LalemTrend[];
  videos?: unknown[];
  useful?: string[];
};

type OpenSheet =
  | { kind: 'toilet'; item: LalemToilet }
  | { kind: 'paper'; item: LalemPaper }
  | { kind: 'medicine'; item: LalemMedicine }
  | { kind: 'trend'; item: LalemTrend };

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
    if (
      parsed?.dock === 'hot' ||
      parsed?.dock === 'useful' ||
      parsed?.dock === 'toilets' ||
      parsed?.dock === 'paper' ||
      parsed?.dock === 'medicine'
    ) {
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

function wikiHref(item: { wikiUrlZh?: string; wikiUrlEn?: string }, nation: Nation): string {
  const raw = nation === 'cn' ? item.wikiUrlZh || '' : item.wikiUrlEn || '';
  try {
    const parsed = new URL(raw);
    const host = parsed.hostname.toLowerCase();
    const want = nation === 'cn' ? 'zh.wikipedia.org' : 'en.wikipedia.org';
    if (parsed.protocol === 'https:' && host === want && parsed.pathname.replace(/\//g, '') !== '') {
      return raw;
    }
  } catch {
    /* ignore invalid */
  }
  return '';
}

function sourceAllowed(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase();
    if (host === 'wikipedia.org' || host.endsWith('.wikipedia.org')) return true;
    return ['nhs.uk', 'mayoclinic.org', 'medlineplus.gov', 'clevelandclinic.org', 'who.int'].some(
      (allow) => host === allow || host.endsWith(`.${allow}`)
    );
  } catch {
    return false;
  }
}

export default function Lalem() {
  const [nation, setNation] = useState<Nation>(() => detectLalemLang());
  const [dock, setDock] = useState<Dock>(() => readDock());
  const [toilets, setToilets] = useState<LalemToilet[]>([]);
  const [papers, setPapers] = useState<LalemPaper[]>([]);
  const [articles, setArticles] = useState<LalemMedicine[]>([]);
  const [digest, setDigest] = useState<LalemDigest | null>(null);
  const [shape, setShape] = useState('');
  const [size, setSize] = useState('');
  const [klass, setKlass] = useState('');
  const [era, setEra] = useState('');
  const [open, setOpen] = useState<OpenSheet | null>(null);
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
    const load = (path: string, apply: (body: Record<string, unknown>) => void) => {
      fetch(`${apiV1Base()}${path}`)
        .then((res) => (res.ok ? res.json() : Promise.reject(res)))
        .then((body) => {
          if (!gone) apply(body || {});
        })
        .catch(() => {
          /* keep empty */
        });
    };
    load('/lalem/toilets', (body) => {
      setToilets(Array.isArray(body.toilets) ? (body.toilets as LalemToilet[]) : []);
    });
    load('/lalem/papers', (body) => {
      setPapers(Array.isArray(body.papers) ? (body.papers as LalemPaper[]) : []);
    });
    load('/lalem/medicine', (body) => {
      setArticles(Array.isArray(body.articles) ? (body.articles as LalemMedicine[]) : []);
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
  const paperName = (item: LalemPaper) => (nation === 'cn' ? item.title : item.titleEn);
  const paperBlurb = (item: LalemPaper) => (nation === 'cn' ? item.blurb : item.blurbEn);
  const medName = (item: LalemMedicine) => (nation === 'cn' ? item.title : item.titleEn);
  const medBody = (item: LalemMedicine) => (nation === 'cn' ? item.body : item.bodyEn);

  const openTrend = (tr: LalemTrend) => {
    const [kind, id] = (tr.topicId || '').split(':');
    if (kind === 'toilet') {
      const item = toilets.find((row) => row.id === id);
      if (item) {
        setOpen({ kind: 'toilet', item });
        return;
      }
    }
    if (kind === 'paper') {
      const item = papers.find((row) => row.id === id);
      if (item) {
        setOpen({ kind: 'paper', item });
        return;
      }
    }
    if (kind === 'medicine') {
      const item = articles.find((row) => row.id === id);
      if (item) {
        setOpen({ kind: 'medicine', item });
        return;
      }
    }
    setOpen({ kind: 'trend', item: tr });
  };

  const sheetTitle =
    open?.kind === 'toilet'
      ? toiletName(open.item)
      : open?.kind === 'paper'
        ? paperName(open.item)
        : open?.kind === 'medicine'
          ? medName(open.item)
          : open?.kind === 'trend'
            ? open.item.title
            : '';

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
                <article className="ll-card">
                  {wikiHref(item, nation) ? (
                    <a
                      className="ll-card-wiki"
                      href={wikiHref(item, nation)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <img
                        src={item.imageUrl}
                        alt={toiletName(item)}
                        width={320}
                        height={200}
                        {...(i === 0 ? { fetchpriority: 'high' } : {})}
                        loading={i === 0 ? 'eager' : 'lazy'}
                      />
                    </a>
                  ) : (
                    <img src={item.imageUrl} alt={toiletName(item)} width={320} height={200} />
                  )}
                  <button type="button" className="ll-card-open" onClick={() => setOpen({ kind: 'toilet', item })}>
                    <span className="ll-card-title">{toiletName(item)}</span>
                    <span className="ll-card-meta">
                      {tx(`lalem.shape.${item.shape}`)} · {tx(`lalem.era.${item.era}`)}
                    </span>
                  </button>
                </article>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {dock === 'paper' ? (
        <div className="ll-body">
          <ul className="ll-gallery">
            {papers.map((item, i) => (
              <li key={item.id}>
                <article className="ll-card">
                  {wikiHref(item, nation) ? (
                    <a className="ll-card-wiki" href={wikiHref(item, nation)} target="_blank" rel="noopener noreferrer">
                      <img
                        src={item.imageUrl}
                        alt={paperName(item)}
                        width={320}
                        height={200}
                        loading={i === 0 ? 'eager' : 'lazy'}
                      />
                    </a>
                  ) : (
                    <img src={item.imageUrl} alt={paperName(item)} width={320} height={200} />
                  )}
                  <button type="button" className="ll-card-open" onClick={() => setOpen({ kind: 'paper', item })}>
                    <span className="ll-card-title">{paperName(item)}</span>
                    <span className="ll-card-meta">{tx(`lalem.era.${item.era}`)}</span>
                  </button>
                </article>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {dock === 'medicine' ? (
        <div className="ll-body ll-useful">
          <p className="ll-disclaimer">{tx('lalem.disclaimer')}</p>
          <ul className="ll-lore-list">
            {articles.map((item) => (
              <li key={item.id}>
                <button type="button" className="ll-lore-open" onClick={() => setOpen({ kind: 'medicine', item })}>
                  {medName(item)}
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
                <button type="button" className="ll-card ll-trend" onClick={() => openTrend(tr)}>
                  <img
                    src={tr.imageUrl}
                    alt=""
                    width={320}
                    height={200}
                    loading={i < 2 ? 'eager' : 'lazy'}
                  />
                  <h2 className="ll-card-title">{tr.title}</h2>
                  <p>{tr.hook}</p>
                </button>
              </li>
            ))}
          </ul>
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
        <button type="button" className={dock === 'paper' ? 'is-on' : undefined} onClick={() => setDock('paper')}>
          {tx('lalem.dock.paper')}
        </button>
        <button type="button" className={dock === 'medicine' ? 'is-on' : undefined} onClick={() => setDock('medicine')}>
          {tx('lalem.dock.medicine')}
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
              <h2 id={titleId}>{sheetTitle}</h2>
              <button type="button" className="ll-sheet-close" aria-label={tx('lalem.close')} onClick={() => setOpen(null)}>
                ×
              </button>
            </div>
            {open.kind === 'toilet' ? (
              <>
                <img src={open.item.imageUrl} alt="" width={480} height={300} />
                <p className="ll-sheet-meta">
                  {open.item.region} · {tx(`lalem.era.${open.item.era}`)} · {tx(`lalem.shape.${open.item.shape}`)}
                </p>
                <p>{toiletBlurb(open.item)}</p>
                {wikiHref(open.item, nation) ? (
                  <p>
                    <a href={wikiHref(open.item, nation)} target="_blank" rel="noopener noreferrer">
                      {tx('lalem.wiki')}
                    </a>
                  </p>
                ) : null}
                <p className="ll-credit">
                  {tx('lalem.credit')}: {open.item.credit}
                </p>
              </>
            ) : null}
            {open.kind === 'paper' ? (
              <>
                <img src={open.item.imageUrl} alt="" width={480} height={300} />
                <p>{paperBlurb(open.item)}</p>
                {wikiHref(open.item, nation) ? (
                  <p>
                    <a href={wikiHref(open.item, nation)} target="_blank" rel="noopener noreferrer">
                      {tx('lalem.wiki')}
                    </a>
                  </p>
                ) : null}
              </>
            ) : null}
            {open.kind === 'medicine' ? (
              <>
                <p className="ll-disclaimer">{tx('lalem.disclaimer')}</p>
                <p className="ll-lore-body">{medBody(open.item)}</p>
                <ul className="ll-sources">
                  {(open.item.sources || [])
                    .filter((src) => sourceAllowed(src.url))
                    .map((src) => (
                      <li key={src.url}>
                        <a href={src.url} target="_blank" rel="noopener noreferrer">
                          {src.label}
                        </a>
                      </li>
                    ))}
                </ul>
              </>
            ) : null}
            {open.kind === 'trend' ? (
              <>
                {open.item.imageUrl ? <img src={open.item.imageUrl} alt="" width={480} height={300} /> : null}
                <p>{open.item.hook}</p>
                <p className="ll-disclaimer">{tx('lalem.trend.loungeOnly')}</p>
              </>
            ) : null}
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
