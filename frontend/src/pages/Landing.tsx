import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import ShieldLogo from '../components/ShieldLogo';
import { t } from '../i18n/catalog';
import { loadLastNation } from '../utils/nation';
import {
  INVITE_REQUEST_EMAIL,
  INVITE_WHY_MIN_LENGTH,
  validateInviteRequest,
  type InviteMailtoOk,
} from '../utils/inviteMailto';

const Landing: React.FC = () => {
  const nation = loadLastNation();
  const [name, setName] = useState('');
  const [who, setWho] = useState('');
  const [why, setWhy] = useState('');
  const [replyEmail, setReplyEmail] = useState('');
  const [error, setError] = useState('');
  const [mail, setMail] = useState<InviteMailtoOk | null>(null);

  const handleRequest = (e: React.FormEvent) => {
    e.preventDefault();
    const result = validateInviteRequest({ name, who, why, replyEmail });
    if (!result.ok) {
      setError(t(nation, 'landing.needFields'));
      setMail(null);
      return;
    }
    setError('');
    setMail(result);
    if (!process.env.JEST_WORKER_ID) {
      window.location.href = result.href;
    }
  };

  return (
    <div className="app-shell synth-grid-bg synth-scanlines overflow-y-auto">
      <div className="relative min-h-full px-4 py-8 sm:py-12">
        <div className="pointer-events-none absolute top-1/4 left-1/4 h-48 w-48 rounded-full bg-neon-purple/20 blur-3xl animate-glow-shift sm:h-64 sm:w-64" />
        <div className="pointer-events-none absolute bottom-1/4 right-1/4 h-40 w-40 rounded-full bg-neon-cyan/10 blur-3xl" />

        <div className="relative z-10 mx-auto max-w-2xl">
          <header className="mb-8 text-center">
            <ShieldLogo size={56} className="mx-auto mb-3 sm:h-20 sm:w-20" />
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-neon-green/80">{t(nation, 'landing.kicker')}</p>
            <h1 className="font-display text-4xl font-bold tracking-wide neon-text-cyan sm:text-5xl">{t(nation, 'landing.title')}</h1>
            <p className="mt-2 font-mono text-sm uppercase tracking-wide text-synth-muted">{t(nation, 'landing.tagline')}</p>
            <p className="mt-4 text-sm leading-relaxed text-synth-text sm:text-base">{t(nation, 'landing.intro')}</p>
          </header>

          <div className="mb-8 grid gap-3 sm:grid-cols-3">
            {[
              ['landing.maps', 'landing.mapsBody'],
              ['landing.desk', 'landing.deskBody'],
              ['landing.access', 'landing.accessBody'],
            ].map(([title, body]) => (
              <div key={title} className="game-panel p-4">
                <h2 className="font-display text-sm uppercase tracking-wide text-neon-cyan">{t(nation, title)}</h2>
                <p className="mt-2 text-xs text-synth-muted">{t(nation, body)}</p>
              </div>
            ))}
          </div>

          <div className="game-panel p-5 sm:p-6">
            <h2 className="font-display text-lg uppercase tracking-wide text-neon-cyan">{t(nation, 'landing.requestTitle')}</h2>
            <p className="mt-1 mb-4 text-xs text-synth-muted">{t(nation, 'landing.requestHint')}</p>
            {error ? (
              <div className="mb-3 rounded-lg border border-serpico-red/40 bg-serpico-red/10 px-3 py-2 text-xs text-serpico-red">
                {error}
              </div>
            ) : null}
            <form onSubmit={handleRequest} className="space-y-3">
              <label className="block text-xs font-display uppercase tracking-wide text-neon-cyan/90">
                {t(nation, 'landing.name')}
                <input className="synth-input mt-1" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
              </label>
              <label className="block text-xs font-display uppercase tracking-wide text-neon-cyan/90">
                {t(nation, 'landing.who')}
                <input className="synth-input mt-1" value={who} onChange={(e) => setWho(e.target.value)} />
              </label>
              <label className="block text-xs font-display uppercase tracking-wide text-neon-cyan/90">
                {t(nation, 'landing.why')}
                <textarea
                  className="synth-input mt-1 min-h-[6rem]"
                  value={why}
                  onChange={(e) => setWhy(e.target.value)}
                  minLength={INVITE_WHY_MIN_LENGTH}
                />
              </label>
              <label className="block text-xs font-display uppercase tracking-wide text-neon-cyan/90">
                {t(nation, 'landing.replyEmail')}
                <input className="synth-input mt-1" type="email" value={replyEmail} onChange={(e) => setReplyEmail(e.target.value)} />
              </label>
              <button type="submit" className="w-full btn-neon-primary rounded-lg py-3">
                {t(nation, 'landing.send')}
              </button>
            </form>
            {mail ? (
              <div className="mt-4 text-xs text-synth-muted">
                <p>{t(nation, 'landing.mailtoBlocked', { email: INVITE_REQUEST_EMAIL })}</p>
                <a className="mt-2 inline-block break-all text-neon-cyan underline" href={mail.href}>
                  {INVITE_REQUEST_EMAIL}
                </a>
                <pre className="mt-2 whitespace-pre-wrap rounded border border-neon-purple/30 bg-synth-deep/60 p-3 text-[11px] text-synth-text">
                  {mail.body}
                </pre>
              </div>
            ) : null}
          </div>

          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link to="/join" className="btn-neon-primary rounded-lg px-4 py-2 text-sm">
              {t(nation, 'landing.hasCode')}
            </Link>
            <Link to="/login" className="rounded-lg border border-neon-purple/40 px-4 py-2 text-sm text-synth-text">
              {t(nation, 'landing.signIn')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Landing;
