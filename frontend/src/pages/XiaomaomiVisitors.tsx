import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { t } from '../i18n/catalog';
import { XIAOMAOMI_DRINKS } from '../data/xiaomaomiMenu';
import { detectXiaomaomiLang, saveXiaomaomiLang } from '../utils/xiaomaomiLang';
import { enterLoungeWorld, leaveLoungeWorld } from '../utils/loungeWorld';
import { apiV1Base } from '../utils/hardDataUrls';
import type { Nation } from '../utils/nation';

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

function PixelPicture({ pixels, palette, scale }: { pixels: number[]; palette: string[]; scale: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = 16 * scale;
    canvas.height = 16 * scale;
    ctx.imageSmoothingEnabled = false;
    for (let i = 0; i < pixels.length && i < 256; i += 1) {
      ctx.fillStyle = palette[pixels[i]] || FALLBACK_PALETTE[0];
      ctx.fillRect((i % 16) * scale, Math.floor(i / 16) * scale, scale, scale);
    }
  }, [pixels, palette, scale]);
  const size = 16 * scale;
  return <canvas ref={ref} className="xm-pixel" width={size} height={size} aria-hidden="true" />;
}

function VisitModal({
  visit,
  drinkName,
  tasting,
  palette,
  closeLabel,
  onClose,
}: {
  visit: CafeVisit;
  drinkName: string;
  tasting: string;
  palette: string[];
  closeLabel: string;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (typeof dialog.showModal === 'function' && !dialog.open) {
      dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
    const onDialogClose = () => onClose();
    dialog.addEventListener('close', onDialogClose);
    return () => {
      dialog.removeEventListener('close', onDialogClose);
      if (dialog.open && typeof dialog.close === 'function') dialog.close();
    };
  }, [onClose]);
  return (
    <dialog ref={ref} className="xm-visit-modal" aria-labelledby={titleId}>
      {visit.pixels?.length === 256 ? <PixelPicture pixels={visit.pixels} palette={palette} scale={10} /> : null}
      <h2 id={titleId}>{visit.agentName}</h2>
      <p>{drinkName}</p>
      <p>{tasting}</p>
      {visit.review ? <p>{visit.review}</p> : null}
      <button type="button" className="xm-close" onClick={onClose}>
        {closeLabel}
      </button>
    </dialog>
  );
}

export default function XiaomaomiVisitors() {
  const [nation, setNation] = useState<Nation>(() => detectXiaomaomiLang());
  const [visits, setVisits] = useState<CafeVisit[]>([]);
  const [palette, setPalette] = useState<string[]>(FALLBACK_PALETTE);
  const [openId, setOpenId] = useState<string | null>(null);
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

  const drinkName = (visit: CafeVisit) => {
    const drink = XIAOMAOMI_DRINKS.find((item) => item.id === visit.drinkId);
    if (!drink) return visit.drinkId;
    return nation === 'cn' ? drink.title : drink.titleEn;
  };
  const tasting = (visit: CafeVisit) => (nation === 'cn' ? visit.tastingZh : visit.tastingEn);
  const open = visits.find((visit) => visit.id === openId) || null;

  return (
    <main className="xm-page">
      <header className="xm-top">
        <div>
          <p className="xm-kicker">{tx('xiaomaomi.kicker')}</p>
          <h1>{tx('xiaomaomi.visits')}</h1>
        </div>
        <a href="/xiaomaomi">{tx('xiaomaomi.title')}</a>
      </header>
      {visits.length === 0 ? <p>{tx('xiaomaomi.visitsEmpty')}</p> : null}
      <ul className="xm-guest-list">
        {visits.map((visit) => (
          <li key={visit.id}>
            <button type="button" className="xm-guest" onClick={() => setOpenId(visit.id)}>
              {visit.pixels?.length === 256 ? (
                <PixelPicture pixels={visit.pixels} palette={palette} scale={4} />
              ) : (
                <span className="xm-guest-mark" aria-hidden="true" />
              )}
              <span>
                <strong>{visit.agentName}</strong>
                <span className="xm-sub">{drinkName(visit)}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      {open ? (
        <VisitModal
          visit={open}
          drinkName={drinkName(open)}
          tasting={tasting(open)}
          palette={palette}
          closeLabel={tx('xiaomaomi.close')}
          onClose={() => setOpenId(null)}
        />
      ) : null}
    </main>
  );
}
