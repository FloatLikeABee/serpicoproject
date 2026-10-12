import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { t } from '../i18n/catalog';
import { XIAOMAOMI_DRINKS } from '../data/xiaomaomiMenu';
import { detectXiaomaomiLang, saveXiaomaomiLang } from '../utils/xiaomaomiLang';
import { enterLoungeWorld, leaveLoungeWorld } from '../utils/loungeWorld';
import type { Nation } from '../utils/nation';

export default function XiaomaomiDrink() {
  const { id } = useParams();
  const [nation] = useState<Nation>(() => detectXiaomaomiLang());
  const tx = useCallback((key: string) => t(nation, key), [nation]);
  const drink = XIAOMAOMI_DRINKS.find((item) => item.id === id);
  const primary = drink ? (nation === 'cn' ? drink.title : drink.titleEn) : '';
  const secondary = drink ? (nation === 'cn' ? drink.titleEn : drink.title) : '';
  const blurb = drink ? (nation === 'cn' ? drink.blurb : drink.blurbEn) : '';

  useEffect(() => {
    const root = document.documentElement;
    enterLoungeWorld('xm-world');
    root.lang = nation === 'cn' ? 'zh-CN' : 'en';
    saveXiaomaomiLang(nation);
    return () => {
      leaveLoungeWorld();
    };
  }, [nation]);

  return (
    <main className="xm-page xm-drink">
      <a className="xm-back" href="/xiaomaomi">{tx('xiaomaomi.back')}</a>
      {drink ? (
        <>
          <img className="xm-drink-hero" src={drink.imageUrl} alt="" width={640} height={640} />
          <h1>{primary}</h1>
          <p className="xm-sub">{secondary}</p>
          <p>{blurb}</p>
        </>
      ) : null}
    </main>
  );
}
