import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { t } from '../i18n/catalog';
import { loadLastNation, parseNation, saveLastNation, type Nation } from '../utils/nation';
import { publishMqttPayload, waitForHardDataRow, type HardDataRecord } from '../utils/hardDataMqtt';
import {
  apiV1Base,
  DEFAULT_TOPIC,
  MQTT_FILTER,
  mqttWsUrl,
  PROD_HARD_DATA_HTTP,
  PROD_MQTT_WS,
  PROD_PAGE,
} from '../utils/hardDataUrls';

const HTTP_DEFAULT_TOPIC = 'serpico/hard-data/http';

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

const HardDataDocs: React.FC = () => {
  const API_V1 = apiV1Base();
  const httpUrl = `${API_V1}/hard-data`;
  const wsUrl = useMemo(() => mqttWsUrl(API_V1), [API_V1]);
  const [nation, setNation] = useState<Nation>(() => detectNation());
  const [payload, setPayload] = useState('unit 12 on scene');
  const [topic, setTopic] = useState(DEFAULT_TOPIC);
  const [records, setRecords] = useState<HardDataRecord[]>([]);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<'http' | 'mqtt' | null>(null);

  const tx = useCallback((key: string, vars?: Record<string, string | number>) => t(nation, key, vars), [nation]);

  useEffect(() => {
    document.documentElement.lang = nation === 'cn' ? 'zh-CN' : 'en';
    saveLastNation(nation);
  }, [nation]);

  const loadRecords = useCallback(async () => {
    const res = await fetch(httpUrl);
    if (!res.ok) {
      throw new Error(t(nation, 'hardData.getFail', { status: res.status }));
    }
    const data = (await res.json()) as { records?: HardDataRecord[] };
    setRecords(data.records || []);
  }, [httpUrl, nation]);

  useEffect(() => {
    loadRecords().catch((err: unknown) => {
      setError(err instanceof Error ? err.message : tx('hardData.loadFail'));
    });
  }, [loadRecords, tx]);

  const sendDemo = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setStatus('');
    setBusy('http');
    try {
      const res = await fetch(httpUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload, topic: topic.trim() || HTTP_DEFAULT_TOPIC }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || tx('hardData.postFail', { status: res.status }));
      }
      setStatus(tx('hardData.stored', { id: data.id }));
      await loadRecords();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : tx('hardData.sendFail'));
    } finally {
      setBusy(null);
    }
  };

  const sendMqttDemo = async () => {
    setError('');
    setStatus('');
    setBusy('mqtt');
    const topicVal = topic.trim() || DEFAULT_TOPIC;
    try {
      await publishMqttPayload(wsUrl, topicVal, payload);
      const rec = await waitForHardDataRow(httpUrl, { topic: topicVal, payload, source: 'mqtt' });
      setStatus(tx('hardData.stored', { id: rec.id }));
      await loadRecords();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      if (msg === 'timeout' || msg.startsWith('GET ')) {
        setError(tx('hardData.mqttTimeout'));
      } else {
        setError(msg || tx('hardData.mqttFail'));
      }
    } finally {
      setBusy(null);
    }
  };

  const curlPost = `curl -sS -X POST '${httpUrl}' \\
  -H 'Content-Type: application/json' \\
  -d '{"payload":"unit 12 on scene","topic":"${DEFAULT_TOPIC}"}'`;

  const curlGet = `curl -sS '${httpUrl}'`;

  const mqttJs = `import mqtt from 'mqtt'
const client = mqtt.connect('${wsUrl}')
client.on('connect', () => {
  client.publish('${DEFAULT_TOPIC}', 'unit 12 on scene')
})`;

  const langBtn = (id: Nation, label: string) => (
    <button
      type="button"
      onClick={() => {
        setError('');
        setStatus('');
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
            <h1 className="font-display text-2xl sm:text-3xl font-bold neon-text-cyan">{tx('hardData.title')}</h1>
            <p className="mt-2 text-sm text-synth-muted">{tx('hardData.intro')}</p>
            <p className="mt-3 text-sm text-synth-text">
              {tx('hardData.pageUrl')} <code className="text-neon-green">{PROD_PAGE}</code>
            </p>
          </header>

          <section className="game-panel p-4 sm:p-6 space-y-3">
            <h2 className="font-display text-lg neon-text-cyan">{tx('hardData.httpTitle')}</h2>
            <p className="text-sm text-synth-text">
              {tx('hardData.prodHttp')} <code className="text-neon-green">{PROD_HARD_DATA_HTTP}</code>
            </p>
            <p className="text-sm text-synth-muted">
              {tx('hardData.thisEnv')} <code className="text-neon-green">POST {httpUrl}</code>
              <span className="text-synth-muted">{tx('hardData.httpJson')}</span>
              <code className="text-neon-green">{`{ "payload": "...", "topic": "optional" }`}</code>
            </p>
            <p className="text-sm text-synth-muted">
              {tx('hardData.httpDefault', { topic: HTTP_DEFAULT_TOPIC, url: httpUrl })}
            </p>
            <pre className="overflow-x-auto rounded-lg border border-neon-cyan/20 bg-synth-deep/80 p-3 text-xs text-synth-text whitespace-pre-wrap">{curlPost}</pre>
            <pre className="overflow-x-auto rounded-lg border border-neon-cyan/20 bg-synth-deep/80 p-3 text-xs text-synth-text whitespace-pre-wrap">{curlGet}</pre>
          </section>

          <section className="game-panel p-4 sm:p-6 space-y-3">
            <h2 className="font-display text-lg neon-text-cyan">{tx('hardData.mqttTitle')}</h2>
            <p className="text-sm text-synth-text">
              {tx('hardData.prodMqtt')} <code className="text-neon-green">{PROD_MQTT_WS}</code>
            </p>
            <p className="text-sm text-synth-muted">
              {tx('hardData.thisEnv')} <code className="text-neon-green">{wsUrl}</code>
            </p>
            <p className="text-sm text-synth-muted">
              {tx('hardData.mqttHow', { topic: DEFAULT_TOPIC, filter: MQTT_FILTER })}
            </p>
            <pre className="overflow-x-auto rounded-lg border border-neon-cyan/20 bg-synth-deep/80 p-3 text-xs text-synth-text whitespace-pre-wrap">{mqttJs}</pre>
          </section>

          <section className="game-panel p-4 sm:p-6 space-y-3">
            <h2 className="font-display text-lg neon-text-cyan">{tx('hardData.demoTitle')}</h2>
            <form onSubmit={sendDemo} className="space-y-3">
              <div>
                <label className="block text-xs font-display font-semibold mb-2 text-neon-cyan/90 tracking-wide uppercase">
                  {tx('hardData.topic')}
                </label>
                <input
                  className="synth-input"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder={DEFAULT_TOPIC}
                />
              </div>
              <div>
                <label className="block text-xs font-display font-semibold mb-2 text-neon-cyan/90 tracking-wide uppercase">
                  {tx('hardData.payload')}
                </label>
                <textarea
                  className="synth-input min-h-[88px]"
                  value={payload}
                  onChange={(e) => setPayload(e.target.value)}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="submit" disabled={busy !== null} className="btn-neon-primary py-2.5 px-4 rounded-lg disabled:opacity-50">
                  {busy === 'http' ? tx('hardData.sending') : tx('hardData.send')}
                </button>
                <button
                  type="button"
                  disabled={busy !== null}
                  className="btn-neon-primary py-2.5 px-4 rounded-lg disabled:opacity-50"
                  onClick={() => {
                    void sendMqttDemo();
                  }}
                >
                  {busy === 'mqtt' ? tx('hardData.publishing') : tx('hardData.sendMqtt')}
                </button>
                <button
                  type="button"
                  disabled={busy !== null}
                  className="border border-neon-cyan/40 py-2.5 px-4 rounded-lg text-sm text-synth-text hover:border-neon-cyan/70"
                  onClick={() => {
                    setError('');
                    loadRecords().catch((err: unknown) => {
                      setError(err instanceof Error ? err.message : tx('hardData.refreshFail'));
                    });
                  }}
                >
                  {tx('hardData.refresh')}
                </button>
              </div>
            </form>
            {status ? <p className="text-sm text-neon-green">{status}</p> : null}
            {error ? <p className="text-sm text-serpico-red">{error}</p> : null}
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
                        {tx('hardData.empty')}
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
        </div>
      </div>
    </div>
  );
};

export default HardDataDocs;
