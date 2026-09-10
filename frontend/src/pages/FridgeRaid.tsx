import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { t } from '../i18n/catalog';
import { detectFridgeRaidLang, saveFridgeRaidLang } from '../utils/fridgeRaidLang';
import { compressFridgeJpeg } from '../utils/fridgeRaidImage';
import { apiV1Base } from '../utils/hardDataUrls';
import type { Nation } from '../utils/nation';

const SESSION_KEY = 'serpico.fridgeRaid.v1';

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

type Bubble = {
  role: 'assistant' | 'user';
  text?: string;
  photo?: boolean;
  cards?: FridgeRaidCards;
};

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
    root.classList.add('fr-world');
    root.classList.remove('synth-world');
    root.lang = nation === 'cn' ? 'zh-CN' : 'en';
    saveFridgeRaidLang(nation);
    return () => {
      root.classList.remove('fr-world');
      root.classList.add('synth-world');
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
          locale: nation === 'cn' ? 'cn' : 'en',
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
                  <SuggestionCard key={ci} card={card} accent={ci} nation={nation} />
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
    </div>
  );
};

function SuggestionCard({
  card,
  accent,
  nation,
}: {
  card: FridgeRaidSuggestion;
  accent: number;
  nation: Nation;
}) {
  const [open, setOpen] = useState(false);
  return (
    <article data-testid="fridge-raid-card" className={`fr-card fr-accent-${accent % 4}`}>
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
          <button type="button" className="fr-tcm-toggle" onClick={() => setOpen((v) => !v)}>
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

export default FridgeRaid;
