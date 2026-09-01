// Rebuild stamp 2026-09-01T04:46Z — path-filtered Render frontend deploy.
export const PROD_FRONTEND = 'https://serpico.onrender.com';
export const PROD_BACKEND = 'https://serpicoproject.onrender.com';
export const PROD_API_V1 = `${PROD_BACKEND}/api/v1`;
export const PROD_HARD_DATA_HTTP = `${PROD_API_V1}/hard-data`;
export const PROD_MQTT_WS = `wss://${PROD_BACKEND.replace('https://', '')}/mqtt`;
export const PROD_PAGE = `${PROD_FRONTEND}/x-hard-data`;
export const MQTT_FILTER = 'serpico/hard-data/#';
export const DEFAULT_TOPIC = 'serpico/hard-data/demo';

export function apiV1Base(): string {
  return (process.env.REACT_APP_API_URL || PROD_API_V1).replace(/\/$/, '');
}

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

export function isLocalApi(apiV1: string): boolean {
  return /localhost|127\.0\.0\.1/i.test(apiV1);
}
