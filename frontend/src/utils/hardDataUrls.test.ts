import { mqttWsUrl, isLocalApi, ownerHandlePath, ownerHandleUrl, PROD_MQTT_WS } from './hardDataUrls';

describe('hard-data URLs', () => {
  it('derives local MQTT WebSocket from localhost API', () => {
    expect(mqttWsUrl('http://localhost:5092/api/v1')).toBe('ws://localhost:5092/mqtt');
    expect(isLocalApi('http://localhost:5092/api/v1')).toBe(true);
  });

  it('uses production MQTT host for the live backend', () => {
    expect(mqttWsUrl('https://serpicoproject.onrender.com/api/v1')).toBe(PROD_MQTT_WS);
    expect(PROD_MQTT_WS).toBe('wss://serpicoproject.onrender.com/mqtt');
    expect(isLocalApi('https://serpicoproject.onrender.com/api/v1')).toBe(false);
  });

  it('builds the owner handle URL from the normalized serial', () => {
    expect(ownerHandleUrl('SN001')).toBe('https://serpico.onrender.com/x-hard-data/hw/SN001');
    expect(ownerHandlePath('SN001')).toBe('/x-hard-data/hw/SN001');
  });
});
