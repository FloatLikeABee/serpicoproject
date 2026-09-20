import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { t } from '../i18n/catalog';
import { detectKuaixiaosanLang, saveKuaixiaosanLang } from '../utils/kuaixiaosanLang';
import { queueLoungePhotos } from '../utils/queueLoungePhotos';
import { enterLoungeWorld, leaveLoungeWorld } from '../utils/loungeWorld';
import { apiV1Base } from '../utils/hardDataUrls';
import type { Nation } from '../utils/nation';

const SESSION_KEY = 'serpico.kuaixiaosan.v1';

const COMPOSITIONS = ['calcium-oxalate', 'uric', 'struvite', 'cystine', 'other'] as const;
const SITES = ['kidney', 'ureter', 'bladder'] as const;
const SIZE_CLASSES = ['grit', 'small', 'staghorn'] as const;
const STAGES = ['forming', 'colic', 'er', 'post-op', 'prevention'] as const;
const PHASES = ['acute', 'passing', 'post-litho', 'post-ureteroscopy', 'prevention'] as const;
const TOPICS = ['formation', 'diet', 'oxalate', 'uric', 'infection', 'procedure', 'anatomy', 'tcm-encyc'] as const;
const KINDS = ['ct', 'us', 'xray', 'anatomy', 'specimen', 'device'] as const;

type Dock = 'stones' | 'cases' | 'recover' | 'lore' | 'imaging' | 'chat';

export type KuaixiaosanStone = {
  id: string;
  title: string;
  titleEn: string;
  blurb: string;
  blurbEn: string;
  composition: string;
  site: string;
  sizeClass: string;
  imageUrl: string;
  wikiUrlZh?: string;
  wikiUrlEn?: string;
  credit: string;
};

export type KuaixiaosanCase = {
  id: string;
  title: string;
  titleEn: string;
  body: string;
  bodyEn: string;
  stage: string;
  imageUrl: string;
  credit: string;
  sources?: KuaixiaosanSource[];
};

export type KuaixiaosanRecover = {
  id: string;
  title: string;
  titleEn: string;
  body: string;
  bodyEn: string;
  phase: string;
  imageUrl: string;
  credit: string;
  sources?: KuaixiaosanSource[];
};

export type KuaixiaosanSource = { label: string; url: string };

export type KuaixiaosanLore = {
  id: string;
  title: string;
  titleEn: string;
  body: string;
  bodyEn: string;
  topic: string;
  imageUrl: string;
  credit: string;
  sources?: KuaixiaosanSource[];
};

export type KuaixiaosanImaging = {
  id: string;
  title: string;
  titleEn: string;
  blurb: string;
  blurbEn: string;
  kind: string;
  imageUrl: string;
  wikiUrlZh?: string;
  wikiUrlEn?: string;
  credit: string;
};

type OpenSheet =
  | { kind: 'stone'; item: KuaixiaosanStone }
  | { kind: 'case'; item: KuaixiaosanCase }
  | { kind: 'recover'; item: KuaixiaosanRecover }
  | { kind: 'lore'; item: KuaixiaosanLore }
  | { kind: 'imaging'; item: KuaixiaosanImaging };

type WikiReader =
  | { status: 'loading'; url: string }
  | { status: 'ok'; title: string; extract: string; sourceUrl: string }
  | { status: 'error'; url: string };

type ChatTurn = { role: 'user' | 'assistant'; text: string };

type SessionSnap = { dock?: Dock };

function kuaixiaosanLocale(nation: Nation): string {
  return nation === 'cn' ? 'cn' : 'en';
}

function loungePath(pathname: string): string {
  return pathname.replace(/\/+$/, '') || '/';
}

function dockFromPath(pathname: string): Dock | null {
  return loungePath(pathname) === '/kuaixiaosan/chat' ? 'chat' : null;
}

function pathForDock(dock: Dock): string {
  return dock === 'chat' ? '/kuaixiaosan/chat' : '/kuaixiaosan';
}

function readDock(): Dock {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return 'stones';
    const parsed = JSON.parse(raw) as SessionSnap;
    if (
      parsed?.dock === 'stones' ||
      parsed?.dock === 'cases' ||
      parsed?.dock === 'recover' ||
      parsed?.dock === 'lore' ||
      parsed?.dock === 'imaging' ||
      parsed?.dock === 'chat'
    ) {
      return parsed.dock;
    }
  } catch {
    /* ignore */
  }
  return 'stones';
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

function sourcedWikiUrl(item: { sources?: KuaixiaosanSource[] }, nation: Nation): string {
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
    return ['nhs.uk', 'mayoclinic.org', 'medlineplus.gov', 'clevelandclinic.org', 'who.int', 'niddk.nih.gov'].some(
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

function fallbackReply(nation: Nation): string {
  return nation === 'cn'
    ? '腰哪里更疼？先小口喝水，滤过尿液。发热加腰痛要立刻就医。这不是诊断。'
    : 'Where does it hurt more? Sip water slowly and strain urine. Fever with flank pain means seek emergency care now.';
}

export default function Kuaixiaosan() {
  const [nation, setNation] = useState<Nation>(() => detectKuaixiaosanLang());
  const [dock, setDock] = useState<Dock>(() => dockFromPath(window.location.pathname) ?? readDock());
  const [stones, setStones] = useState<KuaixiaosanStone[]>([]);
  const [cases, setCases] = useState<KuaixiaosanCase[]>([]);
  const [recover, setRecover] = useState<KuaixiaosanRecover[]>([]);
  const [articles, setArticles] = useState<KuaixiaosanLore[]>([]);
  const [imaging, setImaging] = useState<KuaixiaosanImaging[]>([]);
  const [composition, setComposition] = useState('');
  const [site, setSite] = useState('');
  const [sizeClass, setSizeClass] = useState('');
  const [stage, setStage] = useState('');
  const [phase, setPhase] = useState('');
  const [topic, setTopic] = useState('');
  const [kind, setKind] = useState('');
  const [open, setOpen] = useState<OpenSheet | null>(null);
  const [wiki, setWiki] = useState<WikiReader | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [thinkStatic] = useState(() => prefersReducedMotion());
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
    enterLoungeWorld('kx-world');
    root.lang = nation === 'cn' ? 'zh-CN' : 'en';
    saveKuaixiaosanLang(nation);
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
      window.history.pushState({ kuaixiaosanDock: next }, '', want);
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
      setDock((current) => (current === 'chat' ? 'stones' : current));
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
    load('/kuaixiaosan/stones', (body) => {
      setStones(Array.isArray(body.stones) ? (body.stones as KuaixiaosanStone[]) : []);
    });
    load('/kuaixiaosan/cases', (body) => {
      setCases(Array.isArray(body.cases) ? (body.cases as KuaixiaosanCase[]) : []);
    });
    load('/kuaixiaosan/recover', (body) => {
      setRecover(Array.isArray(body.recover) ? (body.recover as KuaixiaosanRecover[]) : []);
    });
    load('/kuaixiaosan/lore', (body) => {
      setArticles(Array.isArray(body.articles) ? (body.articles as KuaixiaosanLore[]) : []);
    });
    load('/kuaixiaosan/imaging', (body) => {
      setImaging(Array.isArray(body.imaging) ? (body.imaging as KuaixiaosanImaging[]) : []);
    });
    return () => {
      gone = true;
    };
  }, []);

  const closeWiki = () => setWiki(null);

  const openWiki = (url: string) => {
    if (!url) return;
    const gen = wikiGen.current + 1;
    wikiGen.current = gen;
    setWiki({ status: 'loading', url });
    fetch(`${apiV1Base()}/kuaixiaosan/wiki?url=${encodeURIComponent(url)}`)
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

  const visibleStones = useMemo(() => {
    return stones.filter((item) => {
      if (composition && item.composition !== composition) return false;
      if (site && item.site !== site) return false;
      if (sizeClass && item.sizeClass !== sizeClass) return false;
      return true;
    });
  }, [stones, composition, site, sizeClass]);

  const visibleCases = useMemo(() => {
    return cases.filter((item) => !stage || item.stage === stage);
  }, [cases, stage]);

  const visibleRecover = useMemo(() => {
    return recover.filter((item) => !phase || item.phase === phase);
  }, [recover, phase]);

  const visibleLore = useMemo(() => {
    return articles.filter((item) => !topic || item.topic === topic);
  }, [articles, topic]);

  const visibleImaging = useMemo(() => {
    return imaging.filter((item) => !kind || item.kind === kind);
  }, [imaging, kind]);

  useEffect(() => {
    if (dock === 'chat') return undefined;
    return queueLoungePhotos(document.querySelector('.kx-gallery'));
  }, [dock, visibleStones, visibleCases, visibleRecover, visibleLore, visibleImaging]);

  const stoneName = (item: KuaixiaosanStone) => (nation === 'cn' ? item.title : item.titleEn);
  const stoneBlurb = (item: KuaixiaosanStone) => (nation === 'cn' ? item.blurb : item.blurbEn);
  const caseName = (item: KuaixiaosanCase) => (nation === 'cn' ? item.title : item.titleEn);
  const caseBody = (item: KuaixiaosanCase) => (nation === 'cn' ? item.body : item.bodyEn);
  const recoverName = (item: KuaixiaosanRecover) => (nation === 'cn' ? item.title : item.titleEn);
  const recoverBody = (item: KuaixiaosanRecover) => (nation === 'cn' ? item.body : item.bodyEn);
  const loreName = (item: KuaixiaosanLore) => (nation === 'cn' ? item.title : item.titleEn);
  const loreBody = (item: KuaixiaosanLore) => (nation === 'cn' ? item.body : item.bodyEn);
  const imagingName = (item: KuaixiaosanImaging) => (nation === 'cn' ? item.title : item.titleEn);
  const imagingBlurb = (item: KuaixiaosanImaging) => (nation === 'cn' ? item.blurb : item.blurbEn);

  const elapsed =
    sessionOver && frozenElapsed.current !== null
      ? frozenElapsed.current
      : Math.max(0, Math.floor((nowMs - started.current) / 1000));
  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;

  const sheetTitle =
    open?.kind === 'stone'
      ? stoneName(open.item)
      : open?.kind === 'case'
        ? caseName(open.item)
        : open?.kind === 'recover'
          ? recoverName(open.item)
          : open?.kind === 'lore'
            ? loreName(open.item)
            : open?.kind === 'imaging'
              ? imagingName(open.item)
              : '';

  const endSession = () => {
    if (sessionOver) return;
    frozenElapsed.current = Math.max(0, Math.floor((Date.now() - started.current) / 1000));
    setSessionOver(true);
  };

  const sendChat = useCallback(() => {
    const message = chatDraft.trim();
    if (!message || chatBusy) return;
    const history = chatTurns.slice(-6).map((turn) => ({ role: turn.role, text: turn.text }));
    setChatDraft('');
    setChatTurns((prev) => prev.concat([{ role: 'user', text: message }]));
    setChatBusy(true);
    fetch(`${apiV1Base()}/kuaixiaosan/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locale: kuaixiaosanLocale(nation), message, history }),
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((body: { reply?: string }) => {
        const reply = String(body?.reply || '').trim();
        if (!reply || /you have|你患有/i.test(reply)) {
          setChatTurns((prev) => prev.concat([{ role: 'assistant', text: fallbackReply(nation) }]));
          return;
        }
        setChatTurns((prev) => prev.concat([{ role: 'assistant', text: reply }]));
      })
      .catch(() => {
        setChatTurns((prev) => prev.concat([{ role: 'assistant', text: fallbackReply(nation) }]));
      })
      .finally(() => setChatBusy(false));
  }, [chatBusy, chatDraft, chatTurns, nation]);

  const queuedPhoto = (src: string, alt: string) => (
    <span className="kx-ph">
      <img data-src={src} alt={alt} width={320} height={320} />
    </span>
  );

  const sourceList = (sources?: KuaixiaosanSource[]) => (
    <ul className="kx-sources">
      {(sources || [])
        .filter((src) => sourceAllowed(src.url))
        .map((src) => (
          <li key={src.url}>
            {isWikipediaUrl(src.url) ? (
              <button type="button" className="kx-wiki-open" onClick={() => openWiki(src.url)}>
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
  );

  return (
    <main className="kx-page">
      <header className="kx-top">
        <div>
          <p className="kx-kicker">{tx('kuaixiaosan.kicker')}</p>
          <h1>{tx('kuaixiaosan.title')}</h1>
          <p className="kx-timer">{tx('kuaixiaosan.timer', { m: String(minutes), s: pad2(seconds) })}</p>
        </div>
        <div className="kx-lang">
          <button type="button" className="kx-stop" onClick={endSession}>
            {tx('kuaixiaosan.stop')}
          </button>
          <button type="button" className={nation === 'us' ? 'is-on' : undefined} onClick={() => setNation('us')}>
            {tx('kuaixiaosan.langEn')}
          </button>
          <button type="button" className={nation === 'cn' ? 'is-on' : undefined} onClick={() => setNation('cn')}>
            {tx('kuaixiaosan.langZh')}
          </button>
        </div>
      </header>

      {dock === 'stones' ? (
        <div className="kx-body">
          <div className="kx-filters" role="search">
            <ChipRow
              label={tx('kuaixiaosan.filter.composition')}
              allLabel={tx('kuaixiaosan.filter.all')}
              value={composition}
              onChange={setComposition}
              options={COMPOSITIONS.map((id) => ({ id, label: tx(`kuaixiaosan.composition.${id}`) }))}
            />
            <ChipRow
              label={tx('kuaixiaosan.filter.site')}
              allLabel={tx('kuaixiaosan.filter.all')}
              value={site}
              onChange={setSite}
              options={SITES.map((id) => ({ id, label: tx(`kuaixiaosan.site.${id}`) }))}
            />
            <ChipRow
              label={tx('kuaixiaosan.filter.sizeClass')}
              allLabel={tx('kuaixiaosan.filter.all')}
              value={sizeClass}
              onChange={setSizeClass}
              options={SIZE_CLASSES.map((id) => ({ id, label: tx(`kuaixiaosan.sizeClass.${id}`) }))}
            />
          </div>
          <ul className="kx-gallery">
            {visibleStones.map((item) => (
              <li key={item.id}>
                <article className="kx-card">
                  {loungeWikiUrl(item, nation) ? (
                    <button
                      type="button"
                      className="kx-card-wiki"
                      aria-label={`${tx('kuaixiaosan.wiki')}: ${stoneName(item)}`}
                      onClick={() => openWiki(loungeWikiUrl(item, nation))}
                    >
                      {queuedPhoto(item.imageUrl, stoneName(item))}
                    </button>
                  ) : (
                    queuedPhoto(item.imageUrl, stoneName(item))
                  )}
                  <button type="button" className="kx-card-open" onClick={() => setOpen({ kind: 'stone', item })}>
                    <span className="kx-card-title" title={stoneName(item)}>
                      {stoneName(item)}
                    </span>
                    <span className="kx-card-meta">
                      {tx(`kuaixiaosan.composition.${item.composition}`)} · {tx(`kuaixiaosan.site.${item.site}`)}
                    </span>
                  </button>
                </article>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {dock === 'cases' ? (
        <div className="kx-body">
          <p className="kx-disclaimer">{tx('kuaixiaosan.disclaimer')}</p>
          <div className="kx-filters" role="search">
            <ChipRow
              label={tx('kuaixiaosan.filter.stage')}
              allLabel={tx('kuaixiaosan.filter.all')}
              value={stage}
              onChange={setStage}
              options={STAGES.map((id) => ({ id, label: tx(`kuaixiaosan.stage.${id}`) }))}
            />
          </div>
          <ul className="kx-gallery">
            {visibleCases.map((item) => (
              <li key={item.id}>
                <article className="kx-card">
                  {sourcedWikiUrl(item, nation) ? (
                    <button
                      type="button"
                      className="kx-card-wiki"
                      aria-label={`${tx('kuaixiaosan.wiki')}: ${caseName(item)}`}
                      onClick={() => openWiki(sourcedWikiUrl(item, nation))}
                    >
                      {queuedPhoto(item.imageUrl, caseName(item))}
                    </button>
                  ) : (
                    queuedPhoto(item.imageUrl, caseName(item))
                  )}
                  <button type="button" className="kx-card-open" onClick={() => setOpen({ kind: 'case', item })}>
                    <span className="kx-card-title" title={caseName(item)}>
                      {caseName(item)}
                    </span>
                    <span className="kx-card-meta">{tx(`kuaixiaosan.stage.${item.stage}`)}</span>
                  </button>
                </article>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {dock === 'recover' ? (
        <div className="kx-body">
          <p className="kx-disclaimer">{tx('kuaixiaosan.disclaimer')}</p>
          <div className="kx-filters" role="search">
            <ChipRow
              label={tx('kuaixiaosan.filter.phase')}
              allLabel={tx('kuaixiaosan.filter.all')}
              value={phase}
              onChange={setPhase}
              options={PHASES.map((id) => ({ id, label: tx(`kuaixiaosan.phase.${id}`) }))}
            />
          </div>
          <ul className="kx-gallery">
            {visibleRecover.map((item) => (
              <li key={item.id}>
                <article className="kx-card">
                  {sourcedWikiUrl(item, nation) ? (
                    <button
                      type="button"
                      className="kx-card-wiki"
                      aria-label={`${tx('kuaixiaosan.wiki')}: ${recoverName(item)}`}
                      onClick={() => openWiki(sourcedWikiUrl(item, nation))}
                    >
                      {queuedPhoto(item.imageUrl, recoverName(item))}
                    </button>
                  ) : (
                    queuedPhoto(item.imageUrl, recoverName(item))
                  )}
                  <button type="button" className="kx-card-open" onClick={() => setOpen({ kind: 'recover', item })}>
                    <span className="kx-card-title" title={recoverName(item)}>
                      {recoverName(item)}
                    </span>
                    <span className="kx-card-meta">{tx(`kuaixiaosan.phase.${item.phase}`)}</span>
                  </button>
                </article>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {dock === 'lore' ? (
        <div className="kx-body">
          <p className="kx-disclaimer">{tx('kuaixiaosan.disclaimer')}</p>
          <div className="kx-filters" role="search">
            <ChipRow
              label={tx('kuaixiaosan.filter.topic')}
              allLabel={tx('kuaixiaosan.filter.all')}
              value={topic}
              onChange={setTopic}
              options={TOPICS.map((id) => ({ id, label: tx(`kuaixiaosan.topic.${id}`) }))}
            />
          </div>
          <ul className="kx-gallery">
            {visibleLore.map((item) => (
              <li key={item.id}>
                <article className="kx-card">
                  {sourcedWikiUrl(item, nation) ? (
                    <button
                      type="button"
                      className="kx-card-wiki"
                      aria-label={`${tx('kuaixiaosan.wiki')}: ${loreName(item)}`}
                      onClick={() => openWiki(sourcedWikiUrl(item, nation))}
                    >
                      {queuedPhoto(item.imageUrl, loreName(item))}
                    </button>
                  ) : (
                    queuedPhoto(item.imageUrl, loreName(item))
                  )}
                  <button type="button" className="kx-card-open" onClick={() => setOpen({ kind: 'lore', item })}>
                    <span className="kx-card-title" title={loreName(item)}>
                      {loreName(item)}
                    </span>
                    <span className="kx-card-meta">{tx(`kuaixiaosan.topic.${item.topic}`)}</span>
                  </button>
                </article>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {dock === 'imaging' ? (
        <div className="kx-body">
          <div className="kx-filters" role="search">
            <ChipRow
              label={tx('kuaixiaosan.filter.kind')}
              allLabel={tx('kuaixiaosan.filter.all')}
              value={kind}
              onChange={setKind}
              options={KINDS.map((id) => ({ id, label: tx(`kuaixiaosan.kind.${id}`) }))}
            />
          </div>
          <ul className="kx-gallery">
            {visibleImaging.map((item) => (
              <li key={item.id}>
                <article className="kx-card">
                  {loungeWikiUrl(item, nation) ? (
                    <button
                      type="button"
                      className="kx-card-wiki"
                      aria-label={`${tx('kuaixiaosan.wiki')}: ${imagingName(item)}`}
                      onClick={() => openWiki(loungeWikiUrl(item, nation))}
                    >
                      {queuedPhoto(item.imageUrl, imagingName(item))}
                    </button>
                  ) : (
                    queuedPhoto(item.imageUrl, imagingName(item))
                  )}
                  <button type="button" className="kx-card-open" onClick={() => setOpen({ kind: 'imaging', item })}>
                    <span className="kx-card-title" title={imagingName(item)}>
                      {imagingName(item)}
                    </span>
                    <span className="kx-card-meta">{tx(`kuaixiaosan.kind.${item.kind}`)}</span>
                  </button>
                </article>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {dock === 'chat' ? (
        <div className="kx-body kx-chat">
          <p className="kx-disclaimer">{tx('kuaixiaosan.disclaimer')}</p>
          <ul className="kx-chat-log" aria-busy={chatBusy}>
            {chatTurns.map((turn, i) => (
              <li key={`${turn.role}-${i}`} className={`kx-chat-bubble kx-chat-bubble--${turn.role}`}>
                {turn.text}
              </li>
            ))}
            {chatBusy ? (
              <li
                className={`kx-think${thinkStatic ? ' kx-think--static' : ''}`}
                role="status"
                aria-live="polite"
              >
                {tx('kuaixiaosan.think')}
              </li>
            ) : null}
          </ul>
          {chatTurns.length === 0 && !chatBusy ? <p className="kx-disclaimer">{tx('kuaixiaosan.chat.empty')}</p> : null}
          <div className="kx-chat-composer">
            <textarea
              aria-label={tx('kuaixiaosan.chat.composer')}
              placeholder={tx('kuaixiaosan.chat.placeholder')}
              value={chatDraft}
              rows={2}
              disabled={chatBusy}
              onChange={(e) => setChatDraft(e.target.value)}
            />
            <button type="button" onClick={sendChat} disabled={chatBusy || !chatDraft.trim()}>
              {tx('kuaixiaosan.chat.send')}
            </button>
          </div>
        </div>
      ) : null}

      <div className="kx-dock">
        <button type="button" className={dock === 'stones' ? 'is-on' : undefined} onClick={() => goDock('stones')}>
          {tx('kuaixiaosan.dock.stones')}
        </button>
        <button type="button" className={dock === 'cases' ? 'is-on' : undefined} onClick={() => goDock('cases')}>
          {tx('kuaixiaosan.dock.cases')}
        </button>
        <button type="button" className={dock === 'recover' ? 'is-on' : undefined} onClick={() => goDock('recover')}>
          {tx('kuaixiaosan.dock.recover')}
        </button>
        <button type="button" className={dock === 'lore' ? 'is-on' : undefined} onClick={() => goDock('lore')}>
          {tx('kuaixiaosan.dock.lore')}
        </button>
        <button type="button" className={dock === 'imaging' ? 'is-on' : undefined} onClick={() => goDock('imaging')}>
          {tx('kuaixiaosan.dock.imaging')}
        </button>
        <button type="button" className={dock === 'chat' ? 'is-on' : undefined} onClick={() => goDock('chat')}>
          {tx('kuaixiaosan.dock.chat')}
        </button>
      </div>

      {open ? (
        <div className="kx-sheet-backdrop" role="presentation" onClick={() => setOpen(null)}>
          <div
            className="kx-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="kx-sheet-head">
              <h2 id={titleId}>{sheetTitle}</h2>
              <button type="button" className="kx-sheet-close" aria-label={tx('kuaixiaosan.close')} onClick={() => setOpen(null)}>
                ×
              </button>
            </div>
            {open.kind === 'stone' ? (
              <>
                {open.item.imageUrl ? (
                  <img className="kx-sheet-hero" src={open.item.imageUrl} alt="" width={640} height={400} />
                ) : null}
                <ul className="kx-sheet-chips">
                  <li className="kx-sheet-chip">{tx(`kuaixiaosan.composition.${open.item.composition}`)}</li>
                  <li className="kx-sheet-chip">{tx(`kuaixiaosan.site.${open.item.site}`)}</li>
                  <li className="kx-sheet-chip">{tx(`kuaixiaosan.sizeClass.${open.item.sizeClass}`)}</li>
                </ul>
                <p>{stoneBlurb(open.item)}</p>
                {loungeWikiUrl(open.item, nation) ? (
                  <p>
                    <button type="button" className="kx-wiki-open" onClick={() => openWiki(loungeWikiUrl(open.item, nation))}>
                      {tx('kuaixiaosan.wiki')}
                    </button>
                  </p>
                ) : null}
                <p className="kx-credit">
                  {tx('kuaixiaosan.credit')}: {open.item.credit}
                </p>
              </>
            ) : null}
            {open.kind === 'case' ? (
              <>
                {open.item.imageUrl ? (
                  <img className="kx-sheet-hero" src={open.item.imageUrl} alt="" width={640} height={400} />
                ) : null}
                <p className="kx-disclaimer">{tx('kuaixiaosan.disclaimer')}</p>
                <ul className="kx-sheet-chips">
                  <li className="kx-sheet-chip">{tx(`kuaixiaosan.stage.${open.item.stage}`)}</li>
                </ul>
                <p className="kx-lore-body">{caseBody(open.item)}</p>
                {sourceList(open.item.sources)}
              </>
            ) : null}
            {open.kind === 'recover' ? (
              <>
                {open.item.imageUrl ? (
                  <img className="kx-sheet-hero" src={open.item.imageUrl} alt="" width={640} height={400} />
                ) : null}
                <p className="kx-disclaimer">{tx('kuaixiaosan.disclaimer')}</p>
                <ul className="kx-sheet-chips">
                  <li className="kx-sheet-chip">{tx(`kuaixiaosan.phase.${open.item.phase}`)}</li>
                </ul>
                <p className="kx-lore-body">{recoverBody(open.item)}</p>
                {sourceList(open.item.sources)}
              </>
            ) : null}
            {open.kind === 'lore' ? (
              <>
                {open.item.imageUrl ? (
                  <img className="kx-sheet-hero" src={open.item.imageUrl} alt="" width={640} height={400} />
                ) : null}
                <p className="kx-disclaimer">{tx('kuaixiaosan.disclaimer')}</p>
                <p className="kx-lore-body">{loreBody(open.item)}</p>
                {sourceList(open.item.sources)}
              </>
            ) : null}
            {open.kind === 'imaging' ? (
              <>
                {open.item.imageUrl ? (
                  <img className="kx-sheet-hero" src={open.item.imageUrl} alt="" width={640} height={400} />
                ) : null}
                <ul className="kx-sheet-chips">
                  <li className="kx-sheet-chip">{tx(`kuaixiaosan.kind.${open.item.kind}`)}</li>
                </ul>
                <p>{imagingBlurb(open.item)}</p>
                {loungeWikiUrl(open.item, nation) ? (
                  <p>
                    <button type="button" className="kx-wiki-open" onClick={() => openWiki(loungeWikiUrl(open.item, nation))}>
                      {tx('kuaixiaosan.wiki')}
                    </button>
                  </p>
                ) : null}
                <p className="kx-credit">
                  {tx('kuaixiaosan.credit')}: {open.item.credit}
                </p>
              </>
            ) : null}
          </div>
        </div>
      ) : null}

      {wiki ? (
        <div className="kx-wiki-backdrop" role="presentation" onClick={closeWiki}>
          <div
            className="kx-wiki"
            role="dialog"
            aria-modal="true"
            aria-labelledby={wikiTitleId}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="kx-sheet-head">
              <h2 id={wikiTitleId}>{wiki.status === 'ok' && wiki.title ? wiki.title : tx('kuaixiaosan.wiki')}</h2>
              <button type="button" className="kx-sheet-close" aria-label={tx('kuaixiaosan.close')} onClick={closeWiki}>
                ×
              </button>
            </div>
            {wiki.status === 'ok' ? <p className="kx-wiki-extract">{wiki.extract}</p> : null}
            {wiki.status === 'error' ? <p className="kx-wiki-extract">{tx('kuaixiaosan.wikiError')}</p> : null}
            {wiki.status === 'loading' ? <p className="kx-wiki-extract">{tx('kuaixiaosan.wiki')}</p> : null}
            <p className="kx-wiki-source">{wiki.status === 'ok' ? wiki.sourceUrl : wiki.url}</p>
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
    <div className="kx-filter-row">
      <span className="kx-chip-label">{label}</span>
      <div className="kx-chip-wrap">
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
