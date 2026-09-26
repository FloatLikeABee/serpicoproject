import React, { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { t } from '../i18n/catalog';
import { XIAOMAOMI_DRINKS, XiaomaomiDrink, XiaomaomiKind } from '../data/xiaomaomiMenu';
import { detectXiaomaomiLang, saveXiaomaomiLang } from '../utils/xiaomaomiLang';
import { enterLoungeWorld, leaveLoungeWorld } from '../utils/loungeWorld';
import { queueLoungePhotos } from '../utils/queueLoungePhotos';
import type { Nation } from '../utils/nation';

type Chip = 'all' | XiaomaomiKind;

export default function Xiaomaomi() {
  const [nation, setNation] = useState<Nation>(() => detectXiaomaomiLang());
  const [chip, setChip] = useState<Chip>('all');
  const [open, setOpen] = useState<XiaomaomiDrink | null>(null);
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
