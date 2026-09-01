import { connect as mqttConnect } from 'mqtt/dist/mqtt.min.js';

export type HardDataRecord = {
  id: string;
  topic: string;
  payload: string;
  source: string;
  receivedAt: string;
};

const CONNECT_MS = 8000;
const POLL_MS = 8000;
const POLL_EVERY = 250;

export const PROD_MQTT_WS = 'wss://serpicoproject.onrender.com/mqtt';

export function mqttWsUrl(apiV1: string): string {
  const origin = apiV1.replace(/\/api\/v1$/i, '');
  if (origin.startsWith('https://')) {
    return `wss://${origin.slice('https://'.length)}/mqtt`;
  }
  if (origin.startsWith('http://')) {
    return `ws://${origin.slice('http://'.length)}/mqtt`;
  }
  return `${origin}/mqtt`;
}

export function adminMqttUrl(apiV1: string): string {
  return mqttWsUrl(apiV1.replace(/\/$/, ''));
}

export function publishMqttPayload(wsUrl: string, topic: string, payload: string): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const client = mqttConnect(wsUrl, {
      reconnectPeriod: 0,
      connectTimeout: CONNECT_MS,
      protocol: wsUrl.startsWith('wss://') ? 'wss' : wsUrl.startsWith('ws://') ? 'ws' : undefined,
    });

    const finish = (err?: Error) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      try {
        client.end(true);
      } catch {
        /* ignore */
      }
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    };

    const timer = setTimeout(() => finish(new Error('timeout')), CONNECT_MS);

    client.on('error', (err) => {
      finish(err instanceof Error ? err : new Error(String(err)));
    });
    client.on('connect', () => {
      client.publish(topic, payload, { qos: 1 }, (err) => {
        finish(err || undefined);
      });
    });
  });
}

export async function waitForHardwareMessage(
  messagesUrl: string,
  match: { topic: string; payload: string; source: string },
  timeoutMs = POLL_MS
): Promise<HardDataRecord> {
  const started = Date.now();
  let lastError: Error | null = null;
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(messagesUrl);
      if (!res.ok) {
        lastError = new Error(`GET ${res.status}`);
      } else {
        const data = (await res.json()) as { records?: HardDataRecord[] };
        const found = (data.records || []).find(
          (row) => row.source === match.source && row.topic === match.topic && row.payload === match.payload
        );
        if (found) {
          return found;
        }
      }
    } catch (err: unknown) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
    await new Promise((r) => setTimeout(r, POLL_EVERY));
  }
  throw lastError || new Error('timeout');
}
