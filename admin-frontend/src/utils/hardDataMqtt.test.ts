import { adminMqttUrl, mqttWsUrl, PROD_MQTT_WS, waitForHardwareMessage } from './hardDataMqtt';

describe('admin MQTT URLs', () => {
  it('derives local MQTT WebSocket from localhost API', () => {
    expect(mqttWsUrl('http://localhost:5092/api/v1')).toBe('ws://localhost:5092/mqtt');
  });

  it('uses production MQTT host for the live backend', () => {
    expect(mqttWsUrl('https://serpicoproject.onrender.com/api/v1')).toBe(PROD_MQTT_WS);
    expect(PROD_MQTT_WS).toBe('wss://serpicoproject.onrender.com/mqtt');
  });

  it('adminMqttUrl strips a trailing slash on the API base', () => {
    expect(adminMqttUrl('https://serpicoproject.onrender.com/api/v1/')).toBe(PROD_MQTT_WS);
  });
});

describe('waitForHardwareMessage', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns the matching mqtt row and ignores other topics', async () => {
    const match = {
      topic: 'serpico/hard-data/hw/SN-1001',
      payload: 'unit 12 on scene',
      source: 'mqtt',
    };
    const keep = {
      id: 'm1',
      topic: match.topic,
      payload: match.payload,
      source: 'mqtt',
      receivedAt: '2026-09-01T04:00:00Z',
    };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        records: [
          {
            id: 'other',
            topic: 'serpico/hard-data/demo',
            payload: 'other-topic',
            source: 'mqtt',
            receivedAt: '2026-09-01T04:00:00Z',
          },
          keep,
        ],
      }),
    }) as jest.Mock;

    const found = await waitForHardwareMessage('/admin/hardware/dev-1/messages', match);
    expect(found).toEqual(keep);
  });
});
