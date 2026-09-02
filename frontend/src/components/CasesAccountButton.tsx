import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useT } from '../i18n/useT';

const CasesAccountButton: React.FC = () => {
  const { user, logout, setNation } = useAuth();
  const t = useT();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const nation = user?.nation || 'us';

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex-shrink-0 h-[2.15rem] w-[2.15rem] inline-flex items-center justify-center rounded-md border border-neon-cyan/40 text-neon-cyan hover:bg-neon-cyan/15"
        aria-label={t('account.title')}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/60 p-4"
          role="presentation"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-[17rem] game-panel border border-neon-cyan/35 rounded-xl shadow-2xl p-3 space-y-3"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cases-account-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-2">
              <p id="cases-account-title" className="text-[10px] font-display uppercase tracking-wider text-synth-muted">
                {t('account.title')}
              </p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-synth-muted hover:text-white text-sm px-1 min-h-0 min-w-0"
                aria-label={t('account.close')}
              >
                ✕
              </button>
            </div>
            <div className="space-y-2">
              <label className="block text-[10px] font-display uppercase tracking-wider text-neon-cyan/90">
                {t('account.nation')}
              </label>
              <div className="flex gap-2" role="group" aria-label={t('account.nation')}>
                <button
                  type="button"
                  onClick={() => setNation('us')}
                  className={`px-3 py-1.5 rounded-md text-[10px] font-display uppercase border ${
                    nation === 'us'
                      ? 'border-neon-cyan bg-neon-cyan/15 text-neon-cyan'
                      : 'border-white/15 text-gray-300'
                  }`}
                >
                  {t('account.us')}
                </button>
                <button
                  type="button"
                  onClick={() => setNation('cn')}
                  className={`px-3 py-1.5 rounded-md text-[10px] font-display uppercase border ${
                    nation === 'cn'
                      ? 'border-neon-cyan bg-neon-cyan/15 text-neon-cyan'
                      : 'border-white/15 text-gray-300'
                  }`}
                >
                  {t('account.cn')}
                </button>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  logout();
                  navigate('/login');
                }}
                className="px-3 py-1.5 rounded-md text-[10px] font-display uppercase border border-serpico-red/40 text-serpico-red"
              >
                {t('account.logout')}
              </button>
              {user?.name ? (
                <span className="text-[10px] text-synth-muted">{user.name}</span>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
};

export default CasesAccountButton;
