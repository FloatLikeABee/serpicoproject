import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { t } from '../i18n/catalog';
import { detectLalemLang, saveLalemLang } from '../utils/lalemLang';
import { enterLoungeWorld, leaveLoungeWorld } from '../utils/loungeWorld';
import { apiV1Base } from '../utils/hardDataUrls';
import type { Nation } from '../utils/nation';

const SESSION_KEY = 'serpico.lalem.v1';

const SHAPES = ['sit', 'squat', 'urinal', 'pit', 'vacuum', 'portable'] as const;
const SIZES = ['mini', 'standard', 'long', 'accessible', 'child'] as const;
const CLASSES = ['home', 'public', 'transit', 'palace', 'lab', 'luxury'] as const;
const ERAS = ['ancient', 'roman', 'imperial-cn', 'victorian', 'modern', 'space'] as const;

type Dock = 'toilets' | 'paper' | 'medicine' | 'hot' | 'useful' | 'chat';

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
  imageUrl: string;
  credit: string;
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

type WikiReader =
  | { status: 'loading'; url: string }
  | { status: 'ok'; title: string; extract: string; sourceUrl: string }
  | { status: 'error'; url: string };

type ChatTurn = { role: 'user' | 'assistant'; text: string };

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
      parsed?.dock === 'medicine' ||
      parsed?.dock === 'chat'
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

function medicineWikiHref(item: LalemMedicine, nation: Nation): string {
  const sources = item.sources || [];
  const want = nation === 'cn' ? 'zh.wikipedia.org' : 'en.wikipedia.org';
  const wikis = sources.filter((src) => isWikipediaUrl(src.url));
  const matched = wikis.find((src) => {
    try {
      return new URL(src.url).hostname.toLowerCase() === want;
    } catch {
      return false;
    }
  });
  if (matched) return matched.url;
  return wikis.length ? wikis[0].url : '';
}

function sourceAllowed(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase();
    if (host === 'zh.wikipedia.org' || host === 'en.wikipedia.org') return true;
    return ['nhs.uk', 'mayoclinic.org', 'medlineplus.gov', 'clevelandclinic.org', 'who.int'].some(
      (allow) => host === allow || host.endsWith(`.${allow}`)
    );
  } catch {
    return false;
  }
}

function isWikipediaUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase();
    return host === 'zh.wikipedia.org' || host === 'en.wikipedia.org';
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
  const [wiki, setWiki] = useState<WikiReader | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [pageVisible, setPageVisible] = useState(() => (typeof document === 'undefined' ? true : !document.hidden));
  const [sitAlert, setSitAlert] = useState(0);
  const [dismissedSit, setDismissedSit] = useState(0);
  const [visibleSitS, setVisibleSitS] = useState(0);
  const [companion, setCompanion] = useState<{ text: string } | null>(null);
  const [chatTurns, setChatTurns] = useState<ChatTurn[]>([]);
  const [chatDraft, setChatDraft] = useState('');
  const [chatBusy, setChatBusy] = useState(false);
  const started = useRef(Date.now());
  const visibleAccumRef = useRef(0);
  const lastTickRef = useRef(Date.now());
  const lastCompanionSlot = useRef(-1);
  const companionInFlight = useRef(false);
  const titleId = useId();
  const sitTitleId = useId();
  const wikiTitleId = useId();
  const wikiGen = useRef(0);
  const tx = useCallback((key: string, vars?: Record<string, string | number>) => t(nation, key, vars), [nation]);

  useEffect(() => {
    const root = document.documentElement;
    enterLoungeWorld('ll-world');
    root.lang = nation === 'cn' ? 'zh-CN' : 'en';
    saveLalemLang(nation);
    return () => {
      leaveLoungeWorld();
    };
  }, [nation]);

  useEffect(() => {
    const id = window.setInterval(() => {
      const now = Date.now();
      setNowMs(now);
      if (!(typeof document !== 'undefined' && document.hidden)) {
        visibleAccumRef.current += Math.max(0, now - lastTickRef.current) / 1000;
        setVisibleSitS(Math.floor(visibleAccumRef.current));
      }
      lastTickRef.current = now;
    }, 1000);
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

  useEffect(() => {
    if (typeof document !== 'undefined' && document.hidden) return;
    if (sitAlert > 0 || open || wiki) return;
    if (visibleSitS < 90) return;
    const slot = Math.floor((visibleSitS - 90) / 480);
    if (slot <= lastCompanionSlot.current) return;
    if (companionInFlight.current) return;
    companionInFlight.current = true;
    const loc = lalemLocale(nation);
    fetch(`${apiV1Base()}/lalem/companion?locale=${loc}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((body: { text?: string }) => {
        const text = String(body?.text || '').trim();
        if (!text || /you have|你患有/i.test(text)) {
          companionInFlight.current = false;
          return;
        }
        lastCompanionSlot.current = slot;
        setCompanion({ text });
        companionInFlight.current = false;
      })
      .catch(() => {
        companionInFlight.current = false;
      });
  }, [visibleSitS, sitAlert, nation, open, wiki]);

  const openWiki = useCallback((url: string) => {
    if (!url) return;
    const gen = ++wikiGen.current;
    setWiki({ status: 'loading', url });
    fetch(`${apiV1Base()}/lalem/wiki?url=${encodeURIComponent(url)}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((body: { title?: string; extract?: string; sourceUrl?: string }) => {
        if (wikiGen.current !== gen) return;
        const title = String(body.title || '').trim();
        const extract = String(body.extract || '').trim();
        if (!title || !extract) {
          setWiki({ status: 'error', url });
          return;
        }
        setWiki({
          status: 'ok',
          title,
          extract,
          sourceUrl: String(body.sourceUrl || url),
        });
      })
      .catch(() => {
        if (wikiGen.current !== gen) return;
        setWiki({ status: 'error', url });
      });
  }, []);

  const closeWiki = useCallback(() => {
    wikiGen.current += 1;
    setWiki(null);
  }, []);

  const dismissSit = useCallback(() => {
    setDismissedSit((prev) => Math.max(prev, sitAlert, dueSit));
    setSitAlert(0);
  }, [sitAlert, dueSit]);

  useEffect(() => {
    if (!wiki) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeWiki();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [wiki, closeWiki]);

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

  const sendChat = useCallback(() => {
    const message = chatDraft.trim();
    if (!message || chatBusy) return;
    const history = chatTurns.slice(-6).map((turn) => ({ role: turn.role, text: turn.text }));
    setChatDraft('');
    setChatTurns((prev) => prev.concat([{ role: 'user', text: message }]));
    setChatBusy(true);
    fetch(`${apiV1Base()}/lalem/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locale: lalemLocale(nation), message, history }),
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((body: { reply?: string }) => {
        const reply = String(body?.reply || '').trim();
        if (!reply || /you have|你患有/i.test(reply)) {
          setChatTurns((prev) =>
            prev.concat([
              {
                role: 'assistant',
                text:
                  nation === 'cn'
                    ? '洗手泡沫要盖住手心手背，这是好笑的便便科普，不是诊断。'
                    : 'Wash with soap. Funny poop science, not a diagnosis.',
              },
            ])
          );
          return;
        }
        setChatTurns((prev) => prev.concat([{ role: 'assistant', text: reply }]));
      })
      .catch(() => {
        setChatTurns((prev) =>
          prev.concat([
            {
              role: 'assistant',
              text:
                nation === 'cn'
                  ? '隔间信号飘了。先洗手，咱们继续聊便便科普，这不是诊断。'
                  : 'The stall dropped a bar. Wash with soap and stay on poop science — not a diagnosis.',
            },
          ])
        );
      })
      .finally(() => setChatBusy(false));
  }, [chatBusy, chatDraft, chatTurns, nation]);

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
                    <button
                      type="button"
                      className="ll-card-wiki"
                      aria-label={`${tx('lalem.wiki')}: ${toiletName(item)}`}
                      onClick={() => openWiki(wikiHref(item, nation))}
                    >
                      <img
                        src={item.imageUrl}
                        alt={toiletName(item)}
                        width={320}
                        height={320}
                        {...(i === 0 ? { fetchpriority: 'high' } : {})}
                        loading={i === 0 ? 'eager' : 'lazy'}
                      />
                    </button>
                  ) : (
                    <img src={item.imageUrl} alt={toiletName(item)} width={320} height={320} />
                  )}
                  <button type="button" className="ll-card-open" onClick={() => setOpen({ kind: 'toilet', item })}>
                    <span className="ll-card-title" title={toiletName(item)}>
                      {toiletName(item)}
                    </span>
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
                    <button
                      type="button"
                      className="ll-card-wiki"
                      aria-label={`${tx('lalem.wiki')}: ${paperName(item)}`}
                      onClick={() => openWiki(wikiHref(item, nation))}
                    >
                      <img
                        src={item.imageUrl}
                        alt={paperName(item)}
                        width={320}
                        height={320}
                        loading={i === 0 ? 'eager' : 'lazy'}
                      />
                    </button>
                  ) : (
                    <img src={item.imageUrl} alt={paperName(item)} width={320} height={320} />
                  )}
                  <button type="button" className="ll-card-open" onClick={() => setOpen({ kind: 'paper', item })}>
                    <span className="ll-card-title" title={paperName(item)}>
                      {paperName(item)}
                    </span>
                    <span className="ll-card-meta">{tx(`lalem.era.${item.era}`)}</span>
                  </button>
                </article>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {dock === 'medicine' ? (
        <div className="ll-body">
          <p className="ll-disclaimer">{tx('lalem.disclaimer')}</p>
          <ul className="ll-gallery">
            {articles.map((item, i) => (
              <li key={item.id}>
                <article className="ll-card">
                  {medicineWikiHref(item, nation) ? (
                    <button
                      type="button"
                      className="ll-card-wiki"
                      aria-label={`${tx('lalem.wiki')}: ${medName(item)}`}
                      onClick={() => openWiki(medicineWikiHref(item, nation))}
                    >
                      <img
                        src={item.imageUrl}
                        alt={medName(item)}
                        width={320}
                        height={320}
                        loading={i === 0 ? 'eager' : 'lazy'}
                      />
                    </button>
                  ) : (
                    <img src={item.imageUrl} alt={medName(item)} width={320} height={320} />
                  )}
                  <button type="button" className="ll-card-open" onClick={() => setOpen({ kind: 'medicine', item })}>
                    <span className="ll-card-title" title={medName(item)}>
                      {medName(item)}
                    </span>
                  </button>
                </article>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {dock === 'hot' ? (
        <div className="ll-body">
          <ul className="ll-trend-list">
            {(digest?.trends || []).map((tr, i) => (
              <li key={`${tr.title}-${i}`}>
                <button type="button" className="ll-card ll-trend" onClick={() => openTrend(tr)}>
                  {tr.imageUrl ? <img src={tr.imageUrl} alt="" width={56} height={56} /> : null}
                  <span className="ll-trend-tag">{tx(`lalem.kind.${tr.kind === 'fashion' || tr.kind === 'entertainment' ? tr.kind : 'other'}`)}</span>
                  <h2 className="ll-card-title" title={tr.title}>
                    {tr.title}
                  </h2>
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

      {dock === 'chat' ? (
        <div className="ll-body ll-chat">
          <ul className="ll-chat-log">
            {chatTurns.map((turn, i) => (
              <li key={`${turn.role}-${i}`} className={`ll-chat-bubble ll-chat-bubble--${turn.role}`}>
                {turn.text}
              </li>
            ))}
          </ul>
          {chatTurns.length === 0 ? <p className="ll-empty">{tx('lalem.chat.empty')}</p> : null}
          <div className="ll-chat-composer">
            <textarea
              aria-label={tx('lalem.chat.composer')}
              placeholder={tx('lalem.chat.placeholder')}
              value={chatDraft}
              rows={2}
              disabled={chatBusy}
              onChange={(e) => setChatDraft(e.target.value)}
            />
            <button type="button" onClick={sendChat} disabled={chatBusy || !chatDraft.trim()}>
              {tx('lalem.chat.send')}
            </button>
          </div>
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
        <button type="button" className={dock === 'chat' ? 'is-on' : undefined} onClick={() => setDock('chat')}>
          {tx('lalem.dock.chat')}
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
                {open.item.imageUrl ? (
                  <img className="ll-sheet-hero" src={open.item.imageUrl} alt="" width={640} height={400} />
                ) : null}
                <ul className="ll-sheet-chips">
                  <li className="ll-sheet-chip">{tx(`lalem.shape.${open.item.shape}`)}</li>
                  <li className="ll-sheet-chip">{tx(`lalem.era.${open.item.era}`)}</li>
                  <li className="ll-sheet-chip">{open.item.region}</li>
                </ul>
                <p className="ll-sheet-meta">
                  {open.item.region} · {tx(`lalem.era.${open.item.era}`)} · {tx(`lalem.shape.${open.item.shape}`)}
                </p>
                <p>{toiletBlurb(open.item)}</p>
                {wikiHref(open.item, nation) ? (
                  <p>
                    <button type="button" className="ll-wiki-open" onClick={() => openWiki(wikiHref(open.item, nation))}>
                      {tx('lalem.wiki')}
                    </button>
                  </p>
                ) : null}
                <p className="ll-credit">
                  {tx('lalem.credit')}: {open.item.credit}
                </p>
              </>
            ) : null}
            {open.kind === 'paper' ? (
              <>
                {open.item.imageUrl ? (
                  <img className="ll-sheet-hero" src={open.item.imageUrl} alt="" width={640} height={400} />
                ) : null}
                <ul className="ll-sheet-chips">
                  <li className="ll-sheet-chip">{tx(`lalem.era.${open.item.era}`)}</li>
                </ul>
                <p>{paperBlurb(open.item)}</p>
                {wikiHref(open.item, nation) ? (
                  <p>
                    <button type="button" className="ll-wiki-open" onClick={() => openWiki(wikiHref(open.item, nation))}>
                      {tx('lalem.wiki')}
                    </button>
                  </p>
                ) : null}
              </>
            ) : null}
            {open.kind === 'medicine' ? (
              <>
                {open.item.imageUrl ? (
                  <img className="ll-sheet-hero" src={open.item.imageUrl} alt="" width={640} height={400} />
                ) : null}
                <p className="ll-disclaimer">{tx('lalem.disclaimer')}</p>
                <p className="ll-lore-body">{medBody(open.item)}</p>
                <ul className="ll-sources">
                  {(open.item.sources || [])
                    .filter((src) => sourceAllowed(src.url))
                    .map((src) => (
                      <li key={src.url}>
                        {isWikipediaUrl(src.url) ? (
                          <button type="button" className="ll-wiki-open" onClick={() => openWiki(src.url)}>
                            {src.label}
                          </button>
                        ) : (
                          <a href={src.url} target="_blank" rel="noopener noreferrer">
                            {src.label}
                          </a>
                        )}
                      </li>
                    ))}
                </ul>
              </>
            ) : null}
            {open.kind === 'trend' ? (
              <>
                {open.item.imageUrl ? (
                  <img className="ll-sheet-hero" src={open.item.imageUrl} alt="" width={640} height={400} />
                ) : null}
                <ul className="ll-sheet-chips">
                  <li className="ll-sheet-chip">
                    {tx(`lalem.kind.${open.item.kind === 'fashion' || open.item.kind === 'entertainment' ? open.item.kind : 'other'}`)}
                  </li>
                  {(open.item.chips || []).map((chip) => (
                    <li key={chip} className="ll-sheet-chip">
                      {chip}
                    </li>
                  ))}
                </ul>
                <p>{open.item.hook}</p>
                <p className="ll-disclaimer">{tx('lalem.trend.loungeOnly')}</p>
              </>
            ) : null}
          </div>
        </div>
      ) : null}

      {wiki ? (
        <div className="ll-wiki-backdrop" role="presentation" onClick={closeWiki}>
          <div
            className="ll-wiki"
            role="dialog"
            aria-modal="true"
            aria-labelledby={wikiTitleId}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="ll-sheet-head">
              <h2 id={wikiTitleId}>{wiki.status === 'ok' && wiki.title ? wiki.title : tx('lalem.wiki')}</h2>
              <button type="button" className="ll-sheet-close" aria-label={tx('lalem.close')} onClick={closeWiki}>
                ×
              </button>
            </div>
            {wiki.status === 'ok' ? <p className="ll-wiki-extract">{wiki.extract}</p> : null}
            {wiki.status === 'error' ? <p className="ll-wiki-extract">{tx('lalem.wikiError')}</p> : null}
            {wiki.status === 'loading' ? <p className="ll-wiki-extract">{tx('lalem.wiki')}</p> : null}
            <p className="ll-wiki-source">{wiki.status === 'ok' ? wiki.sourceUrl : wiki.url}</p>
          </div>
        </div>
      ) : null}

      {companion && !open && !wiki ? (
        <aside className="ll-companion" role="status" aria-label={tx('lalem.companion.label')}>
          <p className="ll-companion-text">{companion.text}</p>
          <button type="button" className="ll-companion-dismiss" onClick={() => setCompanion(null)}>
            {tx('lalem.companion.dismiss')}
          </button>
        </aside>
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
    <div className="ll-filter-row">
      <span className="ll-chip-label">{label}</span>
      <div className="ll-chip-wrap">
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
    </div>
  );
}
