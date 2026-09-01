import React, { useCallback, useEffect, useMemo, useState } from 'react';

const API_V1 = (process.env.REACT_APP_API_URL || 'https://serpicoproject.onrender.com/api/v1').replace(
  /\/$/,
  ''
);

function mqttWsUrl(apiV1: string): string {
  const origin = apiV1.replace(/\/api\/v1$/i, '');
  if (origin.startsWith('https://')) {
    return `wss://${origin.slice('https://'.length)}/mqtt`;
  }
  if (origin.startsWith('http://')) {
    return `ws://${origin.slice('http://'.length)}/mqtt`;
  }
  return `${origin}/mqtt`;
}

const DEFAULT_TOPIC = 'serpico/hard-data/demo';
const HTTP_DEFAULT_TOPIC = 'serpico/hard-data/http';
const MQTT_FILTER = 'serpico/hard-data/#';

type HardDataRecord = {
  id: string;
  topic: string;
  payload: string;
  source: string;
  receivedAt: string;
};

const HardDataDocs: React.FC = () => {
  const httpUrl = `${API_V1}/hard-data`;
  const wsUrl = useMemo(() => mqttWsUrl(API_V1), []);
  const [payload, setPayload] = useState('unit 12 on scene');
  const [topic, setTopic] = useState(DEFAULT_TOPIC);
  const [records, setRecords] = useState<HardDataRecord[]>([]);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  const loadRecords = useCallback(async () => {
    const res = await fetch(httpUrl);
    if (!res.ok) {
      throw new Error(`GET failed (${res.status})`);
    }
    const data = (await res.json()) as { records?: HardDataRecord[] };
    setRecords(data.records || []);
  }, [httpUrl]);

  useEffect(() => {
    loadRecords().catch((err: unknown) => {
      setError(err instanceof Error ? err.message : 'Could not load records');
    });
  }, [loadRecords]);

  const sendDemo = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setStatus('');
    setSending(true);
    try {
      const res = await fetch(httpUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload, topic: topic.trim() || HTTP_DEFAULT_TOPIC }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `POST failed (${res.status})`);
      }
      setStatus(`Stored id ${data.id}`);
      await loadRecords();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Send failed');
    } finally {
      setSending(false);
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

  return (
    <div className="app-shell synth-grid-bg overflow-y-auto">
      <div className="scroll-area px-3 py-6 sm:px-6">
        <div className="mx-auto w-full max-w-3xl space-y-4 pb-8">
          <header className="game-panel p-4 sm:p-6">
            <p className="font-mono text-[10px] uppercase tracking-widest text-neon-cyan/80">Unlisted · not in officer nav</p>
            <h1 className="font-display text-2xl sm:text-3xl font-bold neon-text-cyan mt-1">Hard data ingest</h1>
            <p className="mt-2 text-sm text-synth-muted">
              Push field facts into Serpico as received (not AI-rewritten). Use HTTP or MQTT over WebSocket on the
              same backend host. This page is public so partners can test without the officer login.
            </p>
          </header>

          <section className="game-panel p-4 sm:p-6 space-y-3">
            <h2 className="font-display text-lg neon-text-cyan">HTTP API</h2>
            <p className="text-sm text-synth-text">
              <code className="text-neon-green">POST {httpUrl}</code>
              <span className="text-synth-muted"> — JSON </span>
              <code className="text-neon-green">{`{ "payload": "...", "topic": "optional" }`}</code>
            </p>
            <p className="text-sm text-synth-muted">
              Default topic if omitted: <code className="text-neon-green">{HTTP_DEFAULT_TOPIC}</code>. Max payload 32 KiB.
              List recent rows: <code className="text-neon-green">GET {httpUrl}</code> (newest first, up to 50).
            </p>
            <pre className="overflow-x-auto rounded-lg border border-neon-cyan/20 bg-synth-deep/80 p-3 text-xs text-synth-text whitespace-pre-wrap">{curlPost}</pre>
            <pre className="overflow-x-auto rounded-lg border border-neon-cyan/20 bg-synth-deep/80 p-3 text-xs text-synth-text whitespace-pre-wrap">{curlGet}</pre>
          </section>

          <section className="game-panel p-4 sm:p-6 space-y-3">
            <h2 className="font-display text-lg neon-text-cyan">MQTT (direct)</h2>
            <p className="text-sm text-synth-text">
              WebSocket endpoint: <code className="text-neon-green">{wsUrl}</code>
            </p>
            <p className="text-sm text-synth-muted">
              Publish to <code className="text-neon-green">{DEFAULT_TOPIC}</code> (or any topic under{' '}
              <code className="text-neon-green">{MQTT_FILTER}</code>). Use MQTT.js, Paho, or another MQTT 3.1.1/5 client
              with WebSocket. TCP port 1883 is not exposed.
            </p>
            <pre className="overflow-x-auto rounded-lg border border-neon-cyan/20 bg-synth-deep/80 p-3 text-xs text-synth-text whitespace-pre-wrap">{mqttJs}</pre>
          </section>

          <section className="game-panel p-4 sm:p-6 space-y-3">
            <h2 className="font-display text-lg neon-text-cyan">Test demo</h2>
            <form onSubmit={sendDemo} className="space-y-3">
              <div>
                <label className="block text-xs font-display font-semibold mb-2 text-neon-cyan/90 tracking-wide uppercase">
                  Topic
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
                  Payload
                </label>
                <textarea
                  className="synth-input min-h-[88px]"
                  value={payload}
                  onChange={(e) => setPayload(e.target.value)}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="submit" disabled={sending} className="btn-neon-primary py-2.5 px-4 rounded-lg disabled:opacity-50">
                  {sending ? 'Sending…' : 'POST sample'}
                </button>
                <button
                  type="button"
                  className="border border-neon-cyan/40 py-2.5 px-4 rounded-lg text-sm text-synth-text hover:border-neon-cyan/70"
                  onClick={() => {
                    setError('');
                    loadRecords().catch((err: unknown) => {
                      setError(err instanceof Error ? err.message : 'Refresh failed');
                    });
                  }}
                >
                  Refresh list
                </button>
              </div>
            </form>
            {status ? <p className="text-sm text-neon-green">{status}</p> : null}
            {error ? <p className="text-sm text-serpico-red">{error}</p> : null}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead>
                  <tr className="text-neon-cyan/80 font-mono uppercase">
                    <th className="py-2 pr-2">When</th>
                    <th className="py-2 pr-2">Source</th>
                    <th className="py-2 pr-2">Topic</th>
                    <th className="py-2">Payload</th>
                  </tr>
                </thead>
                <tbody>
                  {records.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-3 text-synth-muted">
                        No hard data yet. Send a sample above.
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
