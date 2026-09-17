import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { t } from '../i18n/catalog';
import { detectFridgeRaidLang, saveFridgeRaidLang } from '../utils/fridgeRaidLang';
import { compressFridgeJpeg } from '../utils/fridgeRaidImage';
import { enterLoungeWorld, leaveLoungeWorld } from '../utils/loungeWorld';
import { apiV1Base } from '../utils/hardDataUrls';
import type { Nation } from '../utils/nation';

const SESSION_KEY = 'serpico.fridgeRaid.v1';
const DETAIL_CACHE_KEY = 'serpico.fridgeRaid.detail.v1';

export type FridgeRaidSuggestion = {
  title: string;
  titleAlias?: string;
  hook: string;
  chips?: string[];
  tcmNote?: string;
  uses?: string[];
  need?: string[];
};

export type FridgeRaidCards = {
  season?: string;
  solarTerm?: string;
  weather?: { label?: string; tempC?: number };
  askFridgeRaid?: boolean;
  nudge?: string;
  suggestions?: FridgeRaidSuggestion[];
  disclaimer?: string;
  locale?: string;
};

export type FridgeRaidDishDetail = {
  title: string;
  titleAlias?: string;
  steps?: string[];
  tasteNote?: string;
  tcm?: {
    nature?: string;
    flavors?: string[];
    goodFor?: string[];
    caution?: string[];
  };
  disclaimer?: string;
  locale?: string;
};

type Bubble = {
  role: 'assistant' | 'user';
  text?: string;
  photo?: boolean;
  cards?: FridgeRaidCards;
};

function fridgeLocale(nation: Nation): string {
  return nation === 'cn' ? 'cn' : 'en';
}

function detailCacheKey(locale: string, card: FridgeRaidSuggestion): string {
  return `${locale}\n${card.title}\n${(card.uses || []).join(',')}`;
}

function readDetailCache(): Record<string, FridgeRaidDishDetail> {
  try {
    const raw = sessionStorage.getItem(DETAIL_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, FridgeRaidDishDetail>;
    if (parsed && typeof parsed === 'object') return parsed;
  } catch {
    /* ignore */
  }
  return {};
}

function writeDetailCache(map: Record<string, FridgeRaidDishDetail>) {
  try {
    sessionStorage.setItem(DETAIL_CACHE_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

function opening(nation: Nation): Bubble {
  return { role: 'assistant', text: t(nation, 'fridgeRaid.opening') };
}

function loadSession(nation: Nation): Bubble[] {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return [opening(nation)];
    const parsed = JSON.parse(raw) as Bubble[];
    if (Array.isArray(parsed) && parsed.length) return parsed;
  } catch {
    /* ignore */
  }
  return [opening(nation)];
}

function requestGeo(): Promise<{ lat?: number; lon?: number }> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve({});
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => resolve({}),
      { enableHighAccuracy: false, timeout: 2500, maximumAge: 10 * 60 * 1000 }
    );
  });
}

const FridgeRaid: React.FC = () => {
  const [nation, setNation] = useState<Nation>(() => detectFridgeRaidLang());
  const [bubbles, setBubbles] = useState<Bubble[]>(() => loadSession(detectFridgeRaidLang()));
  const [text, setText] = useState('');
  const [plan, setPlan] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [askedGeo, setAskedGeo] = useState(false);
  const [coords, setCoords] = useState<{ lat?: number; lon?: number }>({});
  const fileRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const [detailOpen, setDetailOpen] = useState<{
    card: FridgeRaidSuggestion;
    cards: FridgeRaidCards;
    accent: number;
  } | null>(null);

  const tx = useCallback((key: string) => t(nation, key), [nation]);
  const season = useMemo(() => {
    for (let i = bubbles.length - 1; i >= 0; i -= 1) {
      const s = bubbles[i].cards?.season;
      if (s) return s;
    }
    return '';
  }, [bubbles]);

  useEffect(() => {
    const root = document.documentElement;
    enterLoungeWorld('fr-world');
    root.lang = nation === 'cn' ? 'zh-CN' : 'en';
    saveFridgeRaidLang(nation);
    return () => {
      leaveLoungeWorld();
    };
  }, [nation]);

  useEffect(() => {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(bubbles));
    } catch {
      /* ignore */
    }
  }, [bubbles]);

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ behavior: 'smooth' });
  }, [bubbles, busy]);

  const switchLang = (next: Nation) => {
    setNation(next);
    setBubbles((prev) => {
      if (prev.length === 1 && prev[0].role === 'assistant' && !prev[0].cards) {
        return [opening(next)];
      }
      return prev;
    });
  };

  const clearChat = () => {
    setBubbles([opening(nation)]);
    setError('');
    setPhoto(null);
  };

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const leftover = text.trim();
    const planText = plan.trim();
    if (!leftover && !planText && !photo) return;
    setError('');
    setBusy(true);
    const userBits = [leftover, planText].filter(Boolean).join(' · ');
    setBubbles((prev) => [...prev, { role: 'user', text: userBits || tx('fridgeRaid.photo'), photo: Boolean(photo) }]);
    setText('');
    try {
      let geo = coords;
      if (!askedGeo) {
        setAskedGeo(true);
        geo = await requestGeo();
        setCoords(geo);
      }
      let imageBase64 = '';
      let imageMime = '';
      if (photo) {
        if (photo.size > 6 * 1024 * 1024) {
          setError(tx('fridgeRaid.tooLarge'));
          setBusy(false);
          return;
        }
        const compressed = await compressFridgeJpeg(photo);
        imageBase64 = compressed.base64;
        imageMime = compressed.mime;
      }
      const res = await fetch(`${apiV1Base()}/fridge-raid/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locale: fridgeLocale(nation),
          text: leftover,
          plan: planText,
          imageBase64: imageBase64 || undefined,
          imageMime: imageMime || undefined,
          lat: geo.lat,
          lon: geo.lon,
        }),
      });
      if (res.status === 429) {
        setError(tx('fridgeRaid.rate'));
        return;
      }
      if (!res.ok) {
        setError(tx('fridgeRaid.error'));
        return;
      }
      const cards = (await res.json()) as FridgeRaidCards;
      const assistantText = cards.askFridgeRaid ? cards.nudge : undefined;
      setBubbles((prev) => [...prev, { role: 'assistant', text: assistantText, cards }]);
      setPhoto(null);
    } catch {
      setError(tx('fridgeRaid.error'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`fr-page fr-season-${season || 'default'}`}>
      <header className="fr-top">
        <div>
          <p className="fr-kicker">{tx('fridgeRaid.kicker')}</p>
          <h1>{tx('fridgeRaid.title')}</h1>
        </div>
        <div className="fr-lang">
          <button type="button" className={nation === 'us' ? 'is-on' : ''} onClick={() => switchLang('us')}>
            {tx('fridgeRaid.langEn')}
          </button>
          <button type="button" className={nation === 'cn' ? 'is-on' : ''} onClick={() => switchLang('cn')}>
            {tx('fridgeRaid.langZh')}
          </button>
        </div>
      </header>

      <p className="fr-disclaimer">{tx('fridgeRaid.disclaimer')}</p>

      <div className="fr-thread" aria-live="polite">
        {bubbles.map((b, i) => (
          <div key={i} className={`fr-bubble fr-${b.role}`}>
            {b.text ? <p>{b.text}</p> : null}
            {b.cards?.suggestions?.length ? (
              <div className="fr-cards">
                {b.cards.suggestions.slice(0, 4).map((card, ci) => (
                  <SuggestionCard
                    key={ci}
                    card={card}
                    accent={ci}
                    nation={nation}
                    onOpen={() => setDetailOpen({ card, cards: b.cards!, accent: ci })}
                  />
                ))}
              </div>
            ) : null}
          </div>
        ))}
        {busy ? <p className="fr-busy">{tx('fridgeRaid.busy')}</p> : null}
        {error ? (
          <p className="fr-error">
            {error}{' '}
            <button type="button" onClick={() => setError('')}>
              {tx('fridgeRaid.tryAgain')}
            </button>
          </p>
        ) : null}
        <div ref={endRef} />
      </div>

      <form className="fr-composer" onSubmit={send}>
        <p className="fr-plan-hint">{tx('fridgeRaid.planHint')}</p>
        <input
          className="fr-plan"
          value={plan}
          onChange={(e) => setPlan(e.target.value)}
          placeholder={tx('fridgeRaid.planPlaceholder')}
        />
        <div className="fr-row">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={tx('fridgeRaid.placeholder')}
            rows={2}
          />
        </div>
        <div className="fr-actions">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={(e) => setPhoto(e.target.files?.[0] || null)}
          />
          <button type="button" className="fr-photo" onClick={() => fileRef.current?.click()}>
            {tx('fridgeRaid.photo')}
            {photo ? ' · 1' : ''}
          </button>
          {photo ? (
            <button type="button" className="fr-ghost" onClick={() => setPhoto(null)}>
              {tx('fridgeRaid.removePhoto')}
            </button>
          ) : null}
          <button type="button" className="fr-ghost" onClick={clearChat}>
            {tx('fridgeRaid.clear')}
          </button>
          <button type="submit" className="fr-send" disabled={busy}>
            {tx('fridgeRaid.send')}
          </button>
        </div>
      </form>
      {detailOpen ? (
        <FridgeRaidDetailModal
          nation={nation}
          card={detailOpen.card}
          cards={detailOpen.cards}
          accent={detailOpen.accent}
          onClose={() => setDetailOpen(null)}
        />
      ) : null}
    </div>
  );
};

function SuggestionCard({
  card,
  accent,
  nation,
  onOpen,
}: {
  card: FridgeRaidSuggestion;
  accent: number;
  nation: Nation;
  onOpen: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <article
      data-testid="fridge-raid-card"
      className={`fr-card fr-accent-${accent % 4}`}
      role="button"
      tabIndex={0}
      aria-haspopup="dialog"
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.currentTarget !== e.target) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen();
        }
      }}
    >
      <h2>{card.title}</h2>
      {card.titleAlias ? <p className="fr-alias">{card.titleAlias}</p> : null}
      <p className="fr-hook">{card.hook}</p>
      {card.chips?.length ? (
        <ul className="fr-chips">
          {card.chips.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      ) : null}
      {card.tcmNote ? (
        <div>
          <button
            type="button"
            className="fr-tcm-toggle"
            onClick={(e) => {
              e.stopPropagation();
              setOpen((v) => !v);
            }}
            onKeyDown={(e) => e.stopPropagation()}
          >
            {open ? t(nation, 'fridgeRaid.tcmHide') : t(nation, 'fridgeRaid.tcmMore')}
          </button>
          {open ? <p className="fr-tcm">{card.tcmNote}</p> : null}
        </div>
      ) : null}
      {card.uses?.length ? (
        <p className="fr-meta">
          {t(nation, 'fridgeRaid.uses')}: {card.uses.join(', ')}
        </p>
      ) : null}
      {card.need?.length ? (
        <p className="fr-meta">
          {t(nation, 'fridgeRaid.need')}: {card.need.join(', ')}
        </p>
      ) : null}
    </article>
  );
}

function FridgeRaidDetailModal({
  nation,
  card,
  cards,
  accent,
  onClose,
}: {
  nation: Nation;
  card: FridgeRaidSuggestion;
  cards: FridgeRaidCards;
  accent: number;
  onClose: () => void;
}) {
  const locale = fridgeLocale(nation);
  const cacheKey = detailCacheKey(locale, card);
  const cached = readDetailCache()[cacheKey];
  const [detail, setDetail] = useState<FridgeRaidDishDetail | null>(cached || null);
  const [busy, setBusy] = useState(!cached);
  const [error, setError] = useState('');
  const closeRef = useRef<HTMLButtonElement>(null);
  const titleId = 'fr-modal-title';

  const load = useCallback(async () => {
    const hit = readDetailCache()[cacheKey];
    if (hit) {
      setDetail(hit);
      setBusy(false);
      setError('');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`${apiV1Base()}/fridge-raid/detail`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locale,
          suggestion: card,
          season: cards.season,
          solarTerm: cards.solarTerm,
          weather: cards.weather,
        }),
      });
      if (!res.ok) {
        throw new Error('detail failed');
      }
      const payload = (await res.json()) as FridgeRaidDishDetail;
      const map = readDetailCache();
      map[cacheKey] = payload;
      writeDetailCache(map);
      setDetail(payload);
    } catch {
      setError(t(nation, 'fridgeRaid.detail.error'));
    } finally {
      setBusy(false);
    }
  }, [cacheKey, card, cards.season, cards.solarTerm, cards.weather, locale, nation]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    closeRef.current?.focus?.();
  }, []);

  const steps = detail?.steps?.filter(Boolean) || [];
  const tcm = detail?.tcm;
  const flavors = [tcm?.nature, ...(tcm?.flavors || [])].filter(Boolean) as string[];

  return (
    <div
      className="fr-modal-backdrop"
      data-testid="fridge-raid-modal-backdrop"
      role="presentation"
      onClick={onClose}
    >
      <div
        className={`fr-modal fr-modal-accent-${accent % 4}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="fr-modal-head">
          <div>
            <h2 id={titleId}>{card.title}</h2>
            {card.titleAlias || detail?.titleAlias ? (
              <p className="fr-modal-alias">{card.titleAlias || detail?.titleAlias}</p>
            ) : null}
          </div>
          <button
            ref={closeRef}
            type="button"
            className="fr-modal-close"
            aria-label={t(nation, 'fridgeRaid.detail.close')}
            onClick={onClose}
          >
            ×
          </button>
        </div>
        {busy ? <p className="fr-modal-busy">{t(nation, 'fridgeRaid.detail.busy')}</p> : null}
        {error ? (
          <p className="fr-modal-error">
            {error}{' '}
            <button type="button" onClick={() => void load()}>
              {t(nation, 'fridgeRaid.detail.tryAgain')}
            </button>
          </p>
        ) : null}
        {!busy && !error && detail ? (
          <>
            {detail.tasteNote ? <p className="fr-modal-taste">{detail.tasteNote}</p> : null}
            {steps.length ? (
              <section>
                <h3>{t(nation, 'fridgeRaid.detail.steps')}</h3>
                <ol>
                  {steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              </section>
            ) : null}
            {tcm ? (
              <section>
                <h3>{t(nation, 'fridgeRaid.detail.tcm')}</h3>
                {flavors.length ? (
                  <ul className="fr-modal-tcm-bits">
                    {flavors.map((bit) => (
                      <li key={bit}>{bit}</li>
                    ))}
                  </ul>
                ) : null}
                {tcm.goodFor?.length ? (
                  <div>
                    <p className="fr-modal-sub">{t(nation, 'fridgeRaid.detail.goodFor')}</p>
                    <ul className="fr-modal-good">
                      {tcm.goodFor.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {tcm.caution?.length ? (
                  <div>
                    <p className="fr-modal-sub">{t(nation, 'fridgeRaid.detail.caution')}</p>
                    <ul className="fr-modal-caution">
                      {tcm.caution.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </section>
            ) : null}
            {detail.disclaimer ? <p className="fr-modal-disclaimer">{detail.disclaimer}</p> : null}
          </>
        ) : null}
      </div>
    </div>
  );
}

export default FridgeRaid;
