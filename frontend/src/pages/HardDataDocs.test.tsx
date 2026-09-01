import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { connect as mqttConnect } from 'mqtt';
import HardDataDocs from './HardDataDocs';
import * as urls from '../utils/hardDataUrls';

const mqttRow = {
  id: 'm1',
  topic: 'serpico/hard-data/demo',
  payload: 'unit 12 on scene',
  source: 'mqtt',
  receivedAt: '2026-09-01T04:00:00Z',
};

function mockMqttClient(mode: 'connect' | 'error' = 'connect') {
  const publish = jest.fn((_topic: string, _payload: string, _opts: unknown, cb?: (err?: Error) => void) => {
    if (typeof cb === 'function') {
      cb();
    }
  });
  const end = jest.fn();
  const client = {
    on: (ev: string, fn: (err?: Error) => void) => {
      if (mode === 'connect' && ev === 'connect') {
        setTimeout(() => fn(), 0);
      }
      if (mode === 'error' && ev === 'error') {
        setTimeout(() => fn(new Error('refused')), 0);
      }
      return client;
    },
    publish,
    end,
  };
  return client;
}

jest.mock('mqtt', () => ({
  connect: jest.fn(),
}));

function mockFetchEmptyThenMqtt() {
  let gets = 0;
  global.fetch = jest.fn().mockImplementation((_url: string, init?: RequestInit) => {
    if (init?.method === 'POST') {
      return Promise.resolve({
        ok: true,
        status: 201,
        json: async () => ({ id: 'h1' }),
      });
    }
    gets += 1;
    if (gets <= 1) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ records: [] }),
      });
    }
    return Promise.resolve({
      ok: true,
      json: async () => ({ records: [mqttRow] }),
    });
  }) as jest.Mock;
}

beforeEach(() => {
  localStorage.clear();
  Object.defineProperty(window.navigator, 'language', { configurable: true, value: 'en-US' });
  Object.defineProperty(window.navigator, 'languages', { configurable: true, value: ['en-US'] });
  window.history.replaceState({}, '', '/x-hard-data');
  mockFetchEmptyThenMqtt();
  (mqttConnect as jest.Mock).mockReset();
  (mqttConnect as jest.Mock).mockImplementation(() => mockMqttClient());
});

afterEach(() => {
  (urls.apiV1Base as jest.Mock | undefined)?.mockRestore?.();
});

test('unlisted hard data page shows HTTP, MQTT, and demo without login', async () => {
  render(<HardDataDocs />);
  expect(await screen.findByText(/No hard data yet/i)).toBeInTheDocument();
  expect(screen.getByText(/Hard data ingest/i)).toBeInTheDocument();
  expect(screen.getByText(/HTTP API/i)).toBeInTheDocument();
  expect(screen.getByText(/MQTT \(direct\)/i)).toBeInTheDocument();
  expect(screen.getByText(/serpico\/hard-data\/#/)).toBeInTheDocument();
  expect(screen.getAllByText('wss://serpicoproject.onrender.com/mqtt').length).toBeGreaterThan(0);
  expect(screen.getAllByText('https://serpicoproject.onrender.com/api/v1/hard-data').length).toBeGreaterThan(0);
  expect(screen.getByRole('button', { name: /POST sample/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Publish MQTT/i })).toBeInTheDocument();
});

test('language toggle switches the unlisted page to Simplified Chinese', async () => {
  render(<HardDataDocs />);
  expect(await screen.findByText(/Hard data ingest/i)).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: '中文' }));
  expect(await screen.findByText('硬数据接入')).toBeInTheDocument();
  expect(screen.getByText('HTTP 接口')).toBeInTheDocument();
  expect(screen.getByText('MQTT（直连）')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '提交样例' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '发布 MQTT' })).toBeInTheDocument();
  expect(screen.getByText(/暂无硬数据/)).toBeInTheDocument();
  expect(screen.getAllByText('wss://serpicoproject.onrender.com/mqtt').length).toBeGreaterThan(0);
});

test('Publish MQTT connects to production WSS then lists a source=mqtt row', async () => {
  render(<HardDataDocs />);
  expect(await screen.findByText(/No hard data yet/i)).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: /Publish MQTT/i }));
  await waitFor(() => {
    expect(mqttConnect).toHaveBeenCalledWith(
      'wss://serpicoproject.onrender.com/mqtt',
      expect.objectContaining({ protocol: 'wss' })
    );
  });
  expect(await screen.findByText('mqtt')).toBeInTheDocument();
  expect(screen.getAllByText('unit 12 on scene').length).toBeGreaterThan(1);
  expect(screen.getByText(/Stored id m1/i)).toBeInTheDocument();
});

test('MQTT demo uses localhost /mqtt when the API is local', async () => {
  jest.spyOn(urls, 'apiV1Base').mockReturnValue('http://localhost:5092/api/v1');
  render(<HardDataDocs />);
  expect(await screen.findByText(/No hard data yet/i)).toBeInTheDocument();
  expect(screen.getByText('ws://localhost:5092/mqtt')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: /Publish MQTT/i }));
  await waitFor(() => {
    expect(mqttConnect).toHaveBeenCalledWith(
      'ws://localhost:5092/mqtt',
      expect.objectContaining({ protocol: 'ws' })
    );
  });
});

test('failed MQTT connect shows an error and does not claim stored', async () => {
  (mqttConnect as jest.Mock).mockImplementation(() => mockMqttClient('error'));
  render(<HardDataDocs />);
  expect(await screen.findByText(/No hard data yet/i)).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: /Publish MQTT/i }));
  expect(await screen.findByText(/refused/i)).toBeInTheDocument();
  expect(screen.queryByText(/Stored id/i)).not.toBeInTheDocument();
});
