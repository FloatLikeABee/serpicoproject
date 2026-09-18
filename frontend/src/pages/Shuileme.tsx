import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { t } from '../i18n/catalog';
import { detectShuilemeLang, saveShuilemeLang } from '../utils/shuilemeLang';
import { startShuilemeSound, stopShuilemeSound, SHUILEME_SCENES } from '../utils/shuilemeSound';
import { queueLoungePhotos } from '../utils/queueLoungePhotos';
import { enterLoungeWorld, leaveLoungeWorld } from '../utils/loungeWorld';
import { apiV1Base } from '../utils/hardDataUrls';
import type { Nation } from '../utils/nation';

const SESSION_KEY = 'serpico.shuileme.v1';

const SIZES = ['single', 'double', 'king', 'kang-width'] as const;
const FILLS = ['spring', 'foam', 'futon', 'kang', 'hammock', 'water', 'capsule', 'platform'] as const;
const ERAS = ['ancient', 'tang', 'edo', 'victorian', 'modern', 'space'] as const;
const LIGHTS = ['blackout', 'dim', 'nightlight', 'day-shutters', 'moon'] as const;
const LAYOUTS = ['alcove', 'open', 'capsule', 'sleeper', 'kang-room', 'washitsu', 'tent', 'chamber'] as const;

type Dock = 'beds' | 'rooms' | 'lore' | 'sound' | 'rest' | 'chat';

export type ShuilemeBed = {
  id: string;
  title: string;
  titleEn: string;
  blurb: string;
  blurbEn: string;
  size: string;
  fill: string;
  era: string;
  region: string;
  imageUrl: string;
  wikiUrlZh?: string;
  wikiUrlEn?: string;
  credit: string;
};

export type ShuilemeRoom = {
  id: string;
  title: string;
  titleEn: string;
  blurb: string;
  blurbEn: string;
  light: string;
  layout: string;
  imageUrl: string;
  wikiUrlZh?: string;
  wikiUrlEn?: string;
  credit: string;
};

export type ShuilemeLoreSource = { label: string; url: string };

export type ShuilemeLore = {
  id: string;
  title: string;
  titleEn: string;
  body: string;
  bodyEn: string;
  imageUrl: string;
  credit: string;
  sources?: ShuilemeLoreSource[];
};

type OpenSheet =
  | { kind: 'bed'; item: ShuilemeBed }
  | { kind: 'room'; item: ShuilemeRoom }
  | { kind: 'lore'; item: ShuilemeLore };

type WikiReader =
  | { status: 'loading'; url: string }
  | { status: 'ok'; title: string; extract: string; sourceUrl: string }
  | { status: 'error'; url: string };

type ChatTurn = { role: 'user' | 'assistant'; text: string };

type SessionSnap = { dock?: Dock };

function shuilemeLocale(nation: Nation): string {
  return nation === 'cn' ? 'cn' : 'en';
}

function loungePath(pathname: string): string {
  return pathname.replace(/\/+$/, '') || '/';
}

function dockFromPath(pathname: string): Dock | null {
  return loungePath(pathname) === '/shuileme/chat' ? 'chat' : null;
}

function pathForDock(dock: Dock): string {
  return dock === 'chat' ? '/shuileme/chat' : '/shuileme';
}

function readDock(): Dock {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return 'beds';
    const parsed = JSON.parse(raw) as SessionSnap;
    if (
      parsed?.dock === 'beds' ||
      parsed?.dock === 'rooms' ||
      parsed?.dock === 'lore' ||
      parsed?.dock === 'sound' ||
      parsed?.dock === 'rest' ||
      parsed?.dock === 'chat'
    ) {
      return parsed.dock;
    }
  } catch {
    /* ignore */
  }
  return 'beds';
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function loungeWikiUrl(item: { wikiUrlZh?: string; wikiUrlEn?: string }, nation: Nation): string {
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

function loreWikiUrl(item: ShuilemeLore, nation: Nation): string {
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

function prefersReducedMotion(): boolean {
  try {
    return Boolean(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  } catch {
    return false;
  }
}

export default function Shuileme() {
  const [nation, setNation] = useState<Nation>(() => detectShuilemeLang());
  const [dock, setDock] = useState<Dock>(() => dockFromPath(window.location.pathname) ?? readDock());
  const [beds, setBeds] = useState<ShuilemeBed[]>([]);
  const [rooms, setRooms] = useState<ShuilemeRoom[]>([]);
  const [articles, setArticles] = useState<ShuilemeLore[]>([]);
  const [size, setSize] = useState('');
  const [fill, setFill] = useState('');
  const [era, setEra] = useState('');
  const [light, setLight] = useState('');
  const [layout, setLayout] = useState('');
  const [open, setOpen] = useState<OpenSheet | null>(null);
  const [wiki, setWiki] = useState<WikiReader | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [soundScene, setSoundScene] = useState<string>('');
  const [restStatic] = useState(() => prefersReducedMotion());
  const [sessionOver, setSessionOver] = useState(false);
  const [chatTurns, setChatTurns] = useState<ChatTurn[]>([]);
  const [chatDraft, setChatDraft] = useState('');
  const [chatBusy, setChatBusy] = useState(false);
  const started = useRef(Date.now());
  const frozenElapsed = useRef<number | null>(null);
  const titleId = useId();
  const wikiTitleId = useId();
  const wikiGen = useRef(0);
  const tx = useCallback((key: string, vars?: Record<string, string | number>) => t(nation, key, vars), [nation]);

  useEffect(() => {
    const root = document.documentElement;
    enterLoungeWorld('sm-world');
    root.lang = nation === 'cn' ? 'zh-CN' : 'en';
    saveShuilemeLang(nation);
    return () => {
      leaveLoungeWorld();
    };
  }, [nation]);

  useEffect(() => {
    const id = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  const goDock = useCallback((next: Dock) => {
    setDock(next);
    const want = pathForDock(next);
    if (loungePath(window.location.pathname) !== want) {
      window.history.pushState({ shuilemeDock: next }, '', want);
    }
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ dock }));
    } catch {
      /* ignore */
    }
  }, [dock]);

  useEffect(() => {
    const onPop = () => {
      const fromPath = dockFromPath(window.location.pathname);
      if (fromPath) {
        setDock(fromPath);
        return;
      }
      setDock((current) => (current === 'chat' ? 'beds' : current));
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

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
    load('/shuileme/beds', (body) => {
      setBeds(Array.isArray(body.beds) ? (body.beds as ShuilemeBed[]) : []);
    });
    load('/shuileme/bedrooms', (body) => {
      setRooms(Array.isArray(body.bedrooms) ? (body.bedrooms as ShuilemeRoom[]) : []);
    });
    load('/shuileme/lore', (body) => {
      setArticles(Array.isArray(body.articles) ? (body.articles as ShuilemeLore[]) : []);
    });
    return () => {
      gone = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      stopShuilemeSound();
    };
  }, []);

  const closeWiki = () => setWiki(null);

  const openWiki = (url: string) => {
    if (!url) return;
    const gen = wikiGen.current + 1;
    wikiGen.current = gen;
    setWiki({ status: 'loading', url });
    fetch(`${apiV1Base()}/shuileme/wiki?url=${encodeURIComponent(url)}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((body: { title?: string; extract?: string; sourceUrl?: string }) => {
        if (wikiGen.current !== gen) return;
        const title = String(body?.title || '').trim();
        const extract = String(body?.extract || '').trim();
        if (!title || !extract) {
          setWiki({ status: 'error', url });
          return;
        }
        setWiki({ status: 'ok', title, extract, sourceUrl: String(body?.sourceUrl || url) });
      })
      .catch(() => {
        if (wikiGen.current === gen) setWiki({ status: 'error', url });
      });
  };

  const visibleBeds = useMemo(() => {
    return beds.filter((item) => {
      if (size && item.size !== size) return false;
      if (fill && item.fill !== fill) return false;
      if (era && item.era !== era) return false;
      return true;
    });
  }, [beds, size, fill, era]);

  const visibleRooms = useMemo(() => {
    return rooms.filter((item) => {
      if (light && item.light !== light) return false;
      if (layout && item.layout !== layout) return false;
      return true;
    });
  }, [rooms, light, layout]);

  useEffect(() => {
    if (dock !== 'beds' && dock !== 'rooms') return undefined;
    return queueLoungePhotos(document.querySelector('.sm-gallery'));
  }, [dock, visibleBeds, visibleRooms]);

  const bedName = (item: ShuilemeBed) => (nation === 'cn' ? item.title : item.titleEn);
  const bedBlurb = (item: ShuilemeBed) => (nation === 'cn' ? item.blurb : item.blurbEn);
  const roomName = (item: ShuilemeRoom) => (nation === 'cn' ? item.title : item.titleEn);
  const roomBlurb = (item: ShuilemeRoom) => (nation === 'cn' ? item.blurb : item.blurbEn);
  const loreName = (item: ShuilemeLore) => (nation === 'cn' ? item.title : item.titleEn);
  const loreBody = (item: ShuilemeLore) => (nation === 'cn' ? item.body : item.bodyEn);

  const elapsed =
    sessionOver && frozenElapsed.current !== null
      ? frozenElapsed.current
      : Math.max(0, Math.floor((nowMs - started.current) / 1000));
  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  const restDim = dock === 'rest' && elapsed >= 8 * 60;

  const sheetTitle =
    open?.kind === 'bed' ? bedName(open.item) : open?.kind === 'room' ? roomName(open.item) : open?.kind === 'lore' ? loreName(open.item) : '';

  const playScene = (scene: string) => {
    setSoundScene(scene);
    void startShuilemeSound(scene);
  };

  const stopScene = () => {
    stopShuilemeSound();
    setSoundScene('');
  };

  const endSession = () => {
    if (sessionOver) return;
    frozenElapsed.current = Math.max(0, Math.floor((Date.now() - started.current) / 1000));
    setSessionOver(true);
    stopScene();
  };

  const sendChat = useCallback(() => {
    const message = chatDraft.trim();
    if (!message || chatBusy) return;
    const history = chatTurns.slice(-6).map((turn) => ({ role: turn.role, text: turn.text }));
    setChatDraft('');
    setChatTurns((prev) => prev.concat([{ role: 'user', text: message }]));
    setChatBusy(true);
    fetch(`${apiV1Base()}/shuileme/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locale: shuilemeLocale(nation), message, history }),
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
                    ? '加法可以左右交换。一加二等于二加一。句子短，读着慢。'
                    : 'Addition is commutative. One plus two equals two plus one. Short sentences.',
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
                  ? '加法可以左右交换。一加二等于二加一。句子短，读着慢。'
                  : 'Addition is commutative. One plus two equals two plus one. Short sentences.',
            },
          ])
        );
      })
      .finally(() => setChatBusy(false));
  }, [chatBusy, chatDraft, chatTurns, nation]);

  const queuedPhoto = (src: string, alt: string) => (
    <span className="sm-ph">
      <img data-src={src} alt={alt} width={320} height={320} />
    </span>
  );

  return (
    <main className="sm-page">
      <header className="sm-top">
        <div>
          <p className="sm-kicker">{tx('shuileme.kicker')}</p>
          <h1>{tx('shuileme.title')}</h1>
          <p className="sm-timer">{tx('shuileme.timer', { m: String(minutes), s: pad2(seconds) })}</p>
        </div>
        <div className="sm-lang">
          <button type="button" className="sm-stop" onClick={endSession}>
            {tx('shuileme.stop')}
          </button>
          <button type="button" className={nation === 'us' ? 'is-on' : undefined} onClick={() => setNation('us')}>
            {tx('shuileme.langEn')}
          </button>
          <button type="button" className={nation === 'cn' ? 'is-on' : undefined} onClick={() => setNation('cn')}>
            {tx('shuileme.langZh')}
          </button>
        </div>
      </header>

      {dock === 'beds' ? (
        <div className="sm-body">
          <div className="sm-filters" role="search">
            <ChipRow
              label={tx('shuileme.filter.size')}
              allLabel={tx('shuileme.filter.all')}
              value={size}
              onChange={setSize}
              options={SIZES.map((id) => ({ id, label: tx(`shuileme.size.${id}`) }))}
            />
            <ChipRow
              label={tx('shuileme.filter.fill')}
              allLabel={tx('shuileme.filter.all')}
              value={fill}
              onChange={setFill}
              options={FILLS.map((id) => ({ id, label: tx(`shuileme.fill.${id}`) }))}
            />
            <ChipRow
              label={tx('shuileme.filter.era')}
              allLabel={tx('shuileme.filter.all')}
              value={era}
              onChange={setEra}
              options={ERAS.map((id) => ({ id, label: tx(`shuileme.era.${id}`) }))}
            />
          </div>
          <ul className="sm-gallery">
            {visibleBeds.map((item) => (
              <li key={item.id}>
                <article className="sm-card">
                  {loungeWikiUrl(item, nation) ? (
                    <button
                      type="button"
                      className="sm-card-wiki"
                      aria-label={`${tx('shuileme.wiki')}: ${bedName(item)}`}
                      onClick={() => openWiki(loungeWikiUrl(item, nation))}
                    >
                      {queuedPhoto(item.imageUrl, bedName(item))}
                    </button>
                  ) : (
                    queuedPhoto(item.imageUrl, bedName(item))
                  )}
                  <button type="button" className="sm-card-open" onClick={() => setOpen({ kind: 'bed', item })}>
                    <span className="sm-card-title" title={bedName(item)}>
                      {bedName(item)}
                    </span>
                    <span className="sm-card-meta">
                      {tx(`shuileme.fill.${item.fill}`)} · {tx(`shuileme.era.${item.era}`)}
                    </span>
                  </button>
                </article>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {dock === 'rooms' ? (
        <div className="sm-body">
          <div className="sm-filters" role="search">
            <ChipRow
              label={tx('shuileme.filter.light')}
              allLabel={tx('shuileme.filter.all')}
              value={light}
              onChange={setLight}
              options={LIGHTS.map((id) => ({ id, label: tx(`shuileme.light.${id}`) }))}
            />
            <ChipRow
              label={tx('shuileme.filter.layout')}
              allLabel={tx('shuileme.filter.all')}
              value={layout}
              onChange={setLayout}
              options={LAYOUTS.map((id) => ({ id, label: tx(`shuileme.layout.${id}`) }))}
            />
          </div>
          <ul className="sm-gallery">
            {visibleRooms.map((item) => (
              <li key={item.id}>
                <article className="sm-card">
                  {loungeWikiUrl(item, nation) ? (
                    <button
                      type="button"
                      className="sm-card-wiki"
                      aria-label={`${tx('shuileme.wiki')}: ${roomName(item)}`}
                      onClick={() => openWiki(loungeWikiUrl(item, nation))}
                    >
                      {queuedPhoto(item.imageUrl, roomName(item))}
                    </button>
                  ) : (
                    queuedPhoto(item.imageUrl, roomName(item))
                  )}
                  <button type="button" className="sm-card-open" onClick={() => setOpen({ kind: 'room', item })}>
                    <span className="sm-card-title" title={roomName(item)}>
                      {roomName(item)}
                    </span>
                    <span className="sm-card-meta">
                      {tx(`shuileme.light.${item.light}`)} · {tx(`shuileme.layout.${item.layout}`)}
                    </span>
                  </button>
                </article>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {dock === 'lore' ? (
        <div className="sm-body">
          <p className="sm-disclaimer">{tx('shuileme.disclaimer')}</p>
          <ul className="sm-gallery">
            {articles.map((item, i) => (
              <li key={item.id}>
                <article className="sm-card">
                  {loreWikiUrl(item, nation) ? (
                    <button
                      type="button"
                      className="sm-card-wiki"
                      aria-label={`${tx('shuileme.wiki')}: ${loreName(item)}`}
                      onClick={() => openWiki(loreWikiUrl(item, nation))}
                    >
                      <img src={item.imageUrl} alt={loreName(item)} width={320} height={320} loading={i === 0 ? 'eager' : 'lazy'} />
                    </button>
                  ) : (
                    <img src={item.imageUrl} alt={loreName(item)} width={320} height={320} />
                  )}
                  <button type="button" className="sm-card-open" onClick={() => setOpen({ kind: 'lore', item })}>
                    <span className="sm-card-title" title={loreName(item)}>
                      {loreName(item)}
                    </span>
                  </button>
                </article>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {dock === 'sound' ? (
        <div className="sm-body sm-sound">
          <p className="sm-disclaimer">{soundScene ? tx('shuileme.sound.playing') : tx('shuileme.sound.hint')}</p>
          <div className="sm-sound-grid">
            {SHUILEME_SCENES.map((scene) => (
              <button
                key={scene}
                type="button"
                className={soundScene === scene ? 'is-on' : undefined}
                onClick={() => playScene(scene)}
              >
                {tx(`shuileme.sound.${scene}`)}
              </button>
            ))}
          </div>
          {soundScene ? (
            <div className="sm-sound-tools">
              <button type="button" onClick={stopScene}>
                {tx('shuileme.sound.stop')}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {dock === 'chat' ? (
        <div className="sm-body sm-chat">
          <ul className="sm-chat-log" aria-busy={chatBusy}>
            {chatTurns.map((turn, i) => (
              <li key={`${turn.role}-${i}`} className={`sm-chat-bubble sm-chat-bubble--${turn.role}`}>
                {turn.text}
              </li>
            ))}
            {chatBusy ? (
              <li
                className={`sm-think${restStatic ? ' sm-think--static' : ''}`}
                role="status"
                aria-live="polite"
              >
                {tx('shuileme.think')}
              </li>
            ) : null}
          </ul>
          {chatTurns.length === 0 && !chatBusy ? <p className="sm-disclaimer">{tx('shuileme.chat.empty')}</p> : null}
          <div className="sm-chat-composer">
            <textarea
              aria-label={tx('shuileme.chat.composer')}
              placeholder={tx('shuileme.chat.placeholder')}
              value={chatDraft}
              rows={2}
              disabled={chatBusy}
              onChange={(e) => setChatDraft(e.target.value)}
            />
            <button type="button" onClick={sendChat} disabled={chatBusy || !chatDraft.trim()}>
              {tx('shuileme.chat.send')}
            </button>
          </div>
        </div>
      ) : null}

      {dock === 'rest' ? (
        <div className="sm-body sm-rest">
          <p className="sm-disclaimer">{tx('shuileme.rest.hint')}</p>
          <div
            className={`sm-breathe${restStatic ? ' sm-breathe--static' : ''}${restDim ? ' sm-breathe--dim' : ''}`}
            aria-hidden="true"
          />
        </div>
      ) : null}

      <div className="sm-dock">
        <button type="button" className={dock === 'beds' ? 'is-on' : undefined} onClick={() => goDock('beds')}>
          {tx('shuileme.dock.beds')}
        </button>
        <button type="button" className={dock === 'rooms' ? 'is-on' : undefined} onClick={() => goDock('rooms')}>
          {tx('shuileme.dock.rooms')}
        </button>
        <button type="button" className={dock === 'lore' ? 'is-on' : undefined} onClick={() => goDock('lore')}>
          {tx('shuileme.dock.lore')}
        </button>
        <button type="button" className={dock === 'sound' ? 'is-on' : undefined} onClick={() => goDock('sound')}>
          {tx('shuileme.dock.sound')}
        </button>
        <button type="button" className={dock === 'rest' ? 'is-on' : undefined} onClick={() => goDock('rest')}>
          {tx('shuileme.dock.rest')}
        </button>
        <button type="button" className={dock === 'chat' ? 'is-on' : undefined} onClick={() => goDock('chat')}>
          {tx('shuileme.dock.chat')}
        </button>
      </div>

      {open ? (
        <div className="sm-sheet-backdrop" role="presentation" onClick={() => setOpen(null)}>
          <div
            className="sm-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sm-sheet-head">
              <h2 id={titleId}>{sheetTitle}</h2>
              <button type="button" className="sm-sheet-close" aria-label={tx('shuileme.close')} onClick={() => setOpen(null)}>
                ×
              </button>
            </div>
            {open.kind === 'bed' ? (
              <>
                {open.item.imageUrl ? (
                  <img className="sm-sheet-hero" src={open.item.imageUrl} alt="" width={640} height={400} />
                ) : null}
                <ul className="sm-sheet-chips">
                  <li className="sm-sheet-chip">{tx(`shuileme.size.${open.item.size}`)}</li>
                  <li className="sm-sheet-chip">{tx(`shuileme.fill.${open.item.fill}`)}</li>
                  <li className="sm-sheet-chip">{tx(`shuileme.era.${open.item.era}`)}</li>
                </ul>
                <p>{bedBlurb(open.item)}</p>
                {loungeWikiUrl(open.item, nation) ? (
                  <p>
                    <button type="button" className="sm-wiki-open" onClick={() => openWiki(loungeWikiUrl(open.item, nation))}>
                      {tx('shuileme.wiki')}
                    </button>
                  </p>
                ) : null}
                <p className="sm-credit">
                  {tx('shuileme.credit')}: {open.item.credit}
                </p>
              </>
            ) : null}
            {open.kind === 'room' ? (
              <>
                {open.item.imageUrl ? (
                  <img className="sm-sheet-hero" src={open.item.imageUrl} alt="" width={640} height={400} />
                ) : null}
                <ul className="sm-sheet-chips">
                  <li className="sm-sheet-chip">{tx(`shuileme.light.${open.item.light}`)}</li>
                  <li className="sm-sheet-chip">{tx(`shuileme.layout.${open.item.layout}`)}</li>
                </ul>
                <p>{roomBlurb(open.item)}</p>
                {loungeWikiUrl(open.item, nation) ? (
                  <p>
                    <button type="button" className="sm-wiki-open" onClick={() => openWiki(loungeWikiUrl(open.item, nation))}>
                      {tx('shuileme.wiki')}
                    </button>
                  </p>
                ) : null}
                <p className="sm-credit">
                  {tx('shuileme.credit')}: {open.item.credit}
                </p>
              </>
            ) : null}
            {open.kind === 'lore' ? (
              <>
                {open.item.imageUrl ? (
                  <img className="sm-sheet-hero" src={open.item.imageUrl} alt="" width={640} height={400} />
                ) : null}
                <p className="sm-disclaimer">{tx('shuileme.disclaimer')}</p>
                <p className="sm-lore-body">{loreBody(open.item)}</p>
                <ul className="sm-sources">
                  {(open.item.sources || [])
                    .filter((src) => sourceAllowed(src.url))
                    .map((src) => (
                      <li key={src.url}>
                        {isWikipediaUrl(src.url) ? (
                          <button type="button" className="sm-wiki-open" onClick={() => openWiki(src.url)}>
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
          </div>
        </div>
      ) : null}

      {wiki ? (
        <div className="sm-wiki-backdrop" role="presentation" onClick={closeWiki}>
          <div
            className="sm-wiki"
            role="dialog"
            aria-modal="true"
            aria-labelledby={wikiTitleId}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sm-sheet-head">
              <h2 id={wikiTitleId}>{wiki.status === 'ok' && wiki.title ? wiki.title : tx('shuileme.wiki')}</h2>
              <button type="button" className="sm-sheet-close" aria-label={tx('shuileme.close')} onClick={closeWiki}>
                ×
              </button>
            </div>
            {wiki.status === 'ok' ? <p className="sm-wiki-extract">{wiki.extract}</p> : null}
            {wiki.status === 'error' ? <p className="sm-wiki-extract">{tx('shuileme.wikiError')}</p> : null}
            {wiki.status === 'loading' ? <p className="sm-wiki-extract">{tx('shuileme.wiki')}</p> : null}
            <p className="sm-wiki-source">{wiki.status === 'ok' ? wiki.sourceUrl : wiki.url}</p>
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
    <div className="sm-filter-row">
      <span className="sm-chip-label">{label}</span>
      <div className="sm-chip-wrap">
        <button type="button" className={!value ? 'is-on' : undefined} aria-pressed={!value} onClick={() => onChange('')}>
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
