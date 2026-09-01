import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { t } from '../i18n/catalog';
import { loadLastNation, parseNation, saveLastNation, type Nation } from '../utils/nation';
import type { HardDataRecord } from '../utils/hardDataMqtt';
import { apiV1Base, ownerHandleUrl, PROD_FRONTEND } from '../utils/hardDataUrls';

function detectNation(): Nation {
  try {
    const params = new URLSearchParams(window.location.search);
    const q = params.get('lang') || params.get('nation');
    if (q) {
      return parseNation(q);
    }
  } catch {
    /* ignore */
  }
  try {
    const langs = [navigator.language, ...((navigator.languages as string[]) || [])];
    if (langs.some((l) => /^zh\b/i.test(l || ''))) {
      return 'cn';
    }
  } catch {
    /* ignore */
  }
  return loadLastNation();
}

const HardDataHandle: React.FC = () => {
  const { serial: rawSerial } = useParams<{ serial: string }>();
  const [nation, setNation] = useState<Nation>(() => detectNation());
  const [topic, setTopic] = useState('');
  const [serial, setSerial] = useState('');
  const [records, setRecords] = useState<HardDataRecord[]>([]);
  const [error, setError] = useState('');
  const [notFound, setNotFound] = useState(false);

  const tx = useCallback((key: string, vars?: Record<string, string | number>) => t(nation, key, vars), [nation]);

  useEffect(() => {
    document.documentElement.lang = nation === 'cn' ? 'zh-CN' : 'en';
    saveLastNation(nation);
  }, [nation]);

  const load = useCallback(async () => {
    const pathSerial = (rawSerial || '').trim();
    const url = `${apiV1Base()}/hard-data/hw/${encodeURIComponent(pathSerial)}`;
    const res = await fetch(url);
    if (res.status === 404 || res.status === 400) {
      setNotFound(true);
      setRecords([]);
      setTopic('');
      setSerial(pathSerial.toUpperCase());
      return;
    }
    if (!res.ok) {
      throw new Error(t(nation, 'hardData.getFail', { status: res.status }));
    }
    const data = (await res.json()) as { serial?: string; topic?: string; records?: HardDataRecord[] };
    setNotFound(false);
    setSerial(data.serial || pathSerial.toUpperCase());
    setTopic(data.topic || '');
    setRecords(data.records || []);
  }, [rawSerial, nation]);

  useEffect(() => {
    setError('');
    load().catch((err: unknown) => {
      setError(err instanceof Error ? err.message : tx('hardData.loadFail'));
    });
  }, [load, tx]);

  const langBtn = (id: Nation, label: string) => (
    <button
      type="button"
      onClick={() => {
        setError('');
        setNation(id);
      }}
      className={`px-3 py-1.5 rounded-md text-[10px] font-display uppercase border ${
        nation === id
          ? 'border-neon-cyan bg-neon-cyan/15 text-neon-cyan'
          : 'border-white/15 text-gray-300'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="app-shell synth-grid-bg overflow-y-auto">
      <div className="scroll-area px-3 py-6 sm:px-6">
        <div className="mx-auto w-full max-w-3xl space-y-4 pb-8">
          <header className="game-panel p-4 sm:p-6">
            <div className="flex justify-end">
              <div className="flex gap-2" role="group" aria-label={tx('account.nation')}>
                {langBtn('us', tx('hardData.langEn'))}
                {langBtn('cn', tx('hardData.langZh'))}
              </div>
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold neon-text-cyan">{tx('hardData.handleTitle')}</h1>
            <p className="mt-2 text-sm text-synth-muted">{tx('hardData.handleIntro')}</p>
            {serial ? (
              <p className="mt-3 text-sm text-synth-text">
                {tx('hardData.pageUrl')}{' '}
                <code className="text-neon-green">{ownerHandleUrl(serial, PROD_FRONTEND)}</code>
              </p>
            ) : null}
            {topic ? (
              <p className="mt-2 text-sm text-synth-text">
                {tx('hardData.topic')} <code className="text-neon-green">{topic}</code>
              </p>
            ) : null}
          </header>

          {error ? <p className="text-sm text-serpico-red">{error}</p> : null}

          {notFound ? (
            <section className="game-panel p-4 sm:p-6">
              <p className="text-sm text-synth-muted">{tx('hardData.handleNotFound')}</p>
            </section>
          ) : (
            <section className="game-panel p-4 sm:p-6">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead>
                    <tr className="text-neon-cyan/80 font-mono uppercase">
                      <th className="py-2 pr-2">{tx('hardData.when')}</th>
                      <th className="py-2 pr-2">{tx('hardData.source')}</th>
                      <th className="py-2 pr-2">{tx('hardData.topic')}</th>
                      <th className="py-2">{tx('hardData.payload')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-3 text-synth-muted">
                          {tx('hardData.handleEmpty')}
                        </td>
                      </tr>
                    ) : (
                      records.map((rec) => (
                        <tr key={rec.id} className="border-t border-neon-cyan/10 align-top">
                          <td className="py-2 pr-2 font-mono text-[11px] text-synth-muted whitespace-nowrap">
                            {rec.receivedAt}
                          </td>
                          <td className="py-2 pr-2 text-neon-green">{rec.source}</td>
                          <td className="py-2 pr-2 font-mono text-[11px]">{rec.topic}</td>
                          <td className="py-2 break-all">{rec.payload}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
};

export default HardDataHandle;
