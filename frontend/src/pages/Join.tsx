import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { authAPI } from '../services/api';
import { t } from '../i18n/catalog';
import { loadLastNation } from '../utils/nation';

const Join: React.FC = () => {
  const nation = loadLastNation();
  const [code, setCode] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [copyFlash, setCopyFlash] = useState('');

  const redeem = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await authAPI.redeem(code.trim());
      setUsername(result.username);
      setPassword(result.password);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 429) setError(t(nation, 'join.rate'));
      else if (status === 404) setError(t(nation, 'join.invalid'));
      else setError(t(nation, 'join.failed'));
      setUsername('');
      setPassword('');
    } finally {
      setLoading(false);
    }
  };

  const copy = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopyFlash(label);
    } catch {
      setCopyFlash('');
    }
  };

  return (
    <div className="app-shell synth-grid-bg synth-scanlines overflow-y-auto">
      <div className="relative flex min-h-full items-center justify-center p-4 py-8">
        <div className="pointer-events-none absolute top-1/4 left-1/4 h-40 w-40 rounded-full bg-neon-purple/20 blur-3xl" />
        <div className="relative z-10 w-full max-w-md">
          <div className="game-panel p-5 sm:p-8">
            <h1 className="font-display text-2xl font-bold neon-text-cyan">{t(nation, 'join.title')}</h1>
            <p className="mt-2 mb-4 text-xs text-synth-muted">{t(nation, 'join.subtitle')}</p>
            {error ? (
              <div className="mb-3 rounded-lg border border-serpico-red/40 bg-serpico-red/10 px-3 py-2 text-xs text-serpico-red">
                {error}
              </div>
            ) : null}
            <form onSubmit={redeem} className="space-y-3">
              <label className="block text-xs font-display uppercase tracking-wide text-neon-cyan/90">
                {t(nation, 'join.code')}
                <input
                  className="synth-input mt-1 font-mono"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  autoComplete="off"
                />
              </label>
              <button type="submit" disabled={loading || !code.trim()} className="w-full btn-neon-primary rounded-lg py-3 disabled:opacity-50">
                {loading ? t(nation, 'join.working') : t(nation, 'join.submit')}
              </button>
            </form>
            {username ? (
              <div className="mt-5 space-y-2">
                <p className="text-xs uppercase tracking-wide text-neon-green/80">
                  {t(nation, 'join.username')}: <span className="font-mono text-synth-text">{username}</span>
                </p>
                <p className="text-xs uppercase tracking-wide text-neon-green/80">
                  {t(nation, 'join.password')}: <span className="font-mono text-synth-text">{password}</span>
                </p>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="btn-neon-primary rounded px-3 py-2 text-xs" onClick={() => copy('user', username)}>
                    {t(nation, 'join.copyUser')}
                  </button>
                  <button type="button" className="btn-neon-primary rounded px-3 py-2 text-xs" onClick={() => copy('pass', password)}>
                    {t(nation, 'join.copyPass')}
                  </button>
                </div>
                {copyFlash ? <p className="text-[10px] font-mono text-synth-muted">{copyFlash}</p> : null}
                <Link to="/login" className="mt-2 inline-block text-sm text-neon-cyan underline">
                  {t(nation, 'join.signIn')}
                </Link>
              </div>
            ) : null}
            <Link to="/" className="mt-4 inline-block text-xs text-synth-muted underline">
              {t(nation, 'join.back')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Join;
