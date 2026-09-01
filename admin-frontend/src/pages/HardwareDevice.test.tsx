import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { connect as mqttConnect } from 'mqtt/dist/mqtt.min.js';
import HardwareDevicePage from './HardwareDevice';
import { adminAPI } from '../services/api';

jest.mock('../services/api', () => ({
  API_BASE_URL: 'https://serpicoproject.onrender.com/api/v1',
  adminAPI: {
    getHardware: jest.fn(),
    getHardwareMessages: jest.fn(),
  },
}));

jest.mock('mqtt/dist/mqtt.min.js', () => ({
  connect: jest.fn(),
}));

const device = {
  id: 'dev-1',
  serial: 'SN-1001',
  topic: 'serpico/hard-data/hw/SN-1001',
  createdAt: '2026-09-01T00:00:00Z',
};

const mqttRow = {
  id: 'm1',
  topic: device.topic,
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

function renderPage() {
  return render(
    <MemoryRouter initialEntries={[`/hardware/${device.id}`]}>
      <Routes>
        <Route path="/hardware/:id" element={<HardwareDevicePage />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  (adminAPI.getHardware as jest.Mock).mockResolvedValue({ data: device });
  (adminAPI.getHardwareMessages as jest.Mock)
    .mockResolvedValueOnce({ data: { records: [] } })
    .mockResolvedValue({ data: { records: [mqttRow] } });

  let gets = 0;
  global.fetch = jest.fn().mockImplementation(() => {
    gets += 1;
    if (gets <= 1) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ records: [] }),
      });
    }
    return Promise.resolve({
      ok: true,
      json: async () => ({
        records: [
          mqttRow,
          {
            id: 'other',
            topic: 'serpico/hard-data/demo',
            payload: 'other-topic',
            source: 'mqtt',
            receivedAt: '2026-09-01T04:00:01Z',
          },
        ],
      }),
    });
  }) as jest.Mock;

  (mqttConnect as jest.Mock).mockReset();
  (mqttConnect as jest.Mock).mockImplementation(() => mockMqttClient());
});

test('Publish MQTT uses QoS 1 on the assigned topic and lists source=mqtt only for that topic', async () => {
  const client = mockMqttClient();
  (mqttConnect as jest.Mock).mockImplementation(() => client);

  renderPage();
  expect(await screen.findByRole('heading', { name: 'SN-1001' })).toBeInTheDocument();
  expect(screen.getByText(device.topic)).toBeInTheDocument();
  expect(screen.getByText(/No messages on this topic yet/i)).toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: /Publish MQTT/i }));

  await waitFor(() => {
    expect(mqttConnect).toHaveBeenCalledWith(
      'wss://serpicoproject.onrender.com/mqtt',
      expect.objectContaining({ protocol: 'wss' })
    );
    expect(client.publish).toHaveBeenCalledWith(device.topic, 'unit 12 on scene', { qos: 1 }, expect.any(Function));
  });

  expect(await screen.findByText('mqtt')).toBeInTheDocument();
  expect(screen.getAllByText('unit 12 on scene').length).toBeGreaterThan(1);
  expect(screen.getByText(/Stored id m1/i)).toBeInTheDocument();
  expect(screen.queryByText('other-topic')).not.toBeInTheDocument();
  expect(screen.queryByText('serpico/hard-data/demo')).not.toBeInTheDocument();
});
