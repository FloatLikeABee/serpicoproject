import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { t } from '../i18n/catalog';
import { XIAOMAOMI_DRINKS, XiaomaomiDrink, XiaomaomiKind } from '../data/xiaomaomiMenu';
import { detectXiaomaomiLang, saveXiaomaomiLang } from '../utils/xiaomaomiLang';
import { enterLoungeWorld, leaveLoungeWorld } from '../utils/loungeWorld';
import { queueLoungePhotos } from '../utils/queueLoungePhotos';
import { apiV1Base } from '../utils/hardDataUrls';
import type { Nation } from '../utils/nation';

type Chip = 'all' | XiaomaomiKind;

type CafeVisit = {
  id: string;
  agentName: string;
  drinkId: string;
  tastingZh: string;
  tastingEn: string;
  review: string;
  pixels: number[];
};

const FALLBACK_PALETTE = ['#fff6f2', '#a84d6a', '#f3c3a4', '#f3c1d0', '#6b3a2a', '#3d7a5a', '#fffdfb', '#4a3040'];

function PixelPicture({ pixels, palette }: { pixels: number[]; palette: string[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const scale = 8;
    canvas.width = 16 * scale;
    canvas.height = 16 * scale;
    ctx.imageSmoothingEnabled = false;
    for (let i = 0; i < pixels.length && i < 256; i += 1) {
      ctx.fillStyle = palette[pixels[i]] || FALLBACK_PALETTE[0];
      ctx.fillRect((i % 16) * scale, Math.floor(i / 16) * scale, scale, scale);
    }
  }, [pixels, palette]);
  return <canvas ref={ref} className="xm-pixel" width={128} height={128} aria-hidden="true" />;
}

export default function Xiaomaomi() {
  const [nation, setNation] = useState<Nation>(() => detectXiaomaomiLang());
  const [chip, setChip] = useState<Chip>('all');
  const [open, setOpen] = useState<XiaomaomiDrink | null>(null);
  const [visits, setVisits] = useState<CafeVisit[]>([]);
  const [palette, setPalette] = useState<string[]>(FALLBACK_PALETTE);
  const titleId = useId();
  const tx = useCallback((key: string) => t(nation, key), [nation]);

  useEffect(() => {
    const root = document.documentElement;
    enterLoungeWorld('xm-world');
    root.lang = nation === 'cn' ? 'zh-CN' : 'en';
    saveXiaomaomiLang(nation);
    return () => {
      leaveLoungeWorld();
    };
  }, [nation]);

  const visible = useMemo(
    () => (chip === 'all' ? XIAOMAOMI_DRINKS : XIAOMAOMI_DRINKS.filter((drink) => drink.kind === chip)),
    [chip],
  );

  useEffect(() => {
    return queueLoungePhotos(document.querySelector('.xm-gallery'));
  }, [visible]);

  useEffect(() => {
    let gone = false;
    fetch(`${apiV1Base()}/xiaomaomi/visits`)
      .then((res) => (res.ok ? res.json() : { visits: [] }))
      .then((body: { visits?: CafeVisit[]; palette?: string[] }) => {
        if (gone) return;
        setVisits(Array.isArray(body.visits) ? body.visits : []);
        if (Array.isArray(body.palette) && body.palette.length > 0) setPalette(body.palette);
      })
      .catch(() => {
        if (!gone) setVisits([]);
      });
    return () => {
      gone = true;
    };
  }, []);

  const primary = (drink: XiaomaomiDrink) => (nation === 'cn' ? drink.title : drink.titleEn);
  const secondary = (drink: XiaomaomiDrink) => (nation === 'cn' ? drink.titleEn : drink.title);
  const blurb = (drink: XiaomaomiDrink) => (nation === 'cn' ? drink.blurb : drink.blurbEn);

  const chips: Array<[Chip, string]> = [
    ['all', tx('xiaomaomi.chip.all')],
    ['coffee', tx('xiaomaomi.chip.coffee')],
    ['tea', tx('xiaomaomi.chip.tea')],
    ['fusion', tx('xiaomaomi.chip.fusion')],
  ];

  return (
    <main className="xm-page">
      <header className="xm-top">
        <div>
          <p className="xm-kicker">{tx('xiaomaomi.kicker')}</p>
          <h1>{tx('xiaomaomi.title')}</h1>
        </div>
        <button type="button" className="xm-lang" onClick={() => setNation(nation === 'cn' ? 'us' : 'cn')}>
          {nation === 'cn' ? tx('xiaomaomi.langEn') : tx('xiaomaomi.langZh')}
        </button>
      </header>
      <section className="xm-hero">
        <img src="/xiaomaomi/hero.jpg" alt={tx('xiaomaomi.title')} width={960} height={720} />
        <p>{tx('xiaomaomi.invite')}</p>
      </section>
      <div className="xm-chips">
        {chips.map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={chip === id ? 'xm-chip xm-chip--on' : 'xm-chip'}
            aria-pressed={chip === id}
            onClick={() => setChip(id)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="xm-gallery">
        {visible.map((drink) => (
          <article key={drink.id} className="xm-card">
            <span className="xm-ph">
              <img data-src={drink.imageUrl} alt={primary(drink)} width={320} height={320} />
            </span>
            <button type="button" className="xm-card-open" onClick={() => setOpen(drink)}>
              {primary(drink)}
            </button>
            <p className="xm-sub">{secondary(drink)}</p>
          </article>
        ))}
      </div>
      <section className="xm-visits" aria-label={tx('xiaomaomi.visits')}>
        <h2>{tx('xiaomaomi.visits')}</h2>
        {visits.length === 0 ? <p>{tx('xiaomaomi.visitsEmpty')}</p> : null}
        {visits.map((visit) => {
          const drink = XIAOMAOMI_DRINKS.find((item) => item.id === visit.drinkId);
          const drinkName = drink ? (nation === 'cn' ? drink.title : drink.titleEn) : visit.drinkId;
          const tasting = nation === 'cn' ? visit.tastingZh : visit.tastingEn;
          return (
            <article key={visit.id} className="xm-visit">
              <PixelPicture pixels={visit.pixels || []} palette={palette} />
              <div>
                <h3>{visit.agentName}</h3>
                <p>{drinkName}</p>
                <p>{tasting}</p>
                <p>
                  {tx('xiaomaomi.review')}: {visit.review}
                </p>
              </div>
            </article>
          );
        })}
      </section>
      {open ? (
        <div className="xm-sheet-backdrop" onClick={() => setOpen(null)}>
          <div
            className="xm-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            onClick={(event) => event.stopPropagation()}
          >
            <img className="xm-sheet-hero" src={open.imageUrl} alt="" width={640} height={640} />
            <h2 id={titleId}>{primary(open)}</h2>
            <p className="xm-sub">{secondary(open)}</p>
            <p>{blurb(open)}</p>
            <button type="button" className="xm-close" onClick={() => setOpen(null)}>
              {tx('xiaomaomi.close')}
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}
