import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import HardDataHandle from './HardDataHandle';
import * as urls from '../utils/hardDataUrls';

const mqttRow = {
  id: 'm1',
  topic: 'serpico/hard-data/hw/SN001',
  payload: 'unit 12 on scene',
  source: 'mqtt',
  receivedAt: '2026-09-01T04:00:00Z',
};

function renderHandle(serial: string) {
  return render(
    <MemoryRouter initialEntries={[`/x-hard-data/hw/${serial}`]}>
      <Routes>
        <Route path="/x-hard-data/hw/:serial" element={<HardDataHandle />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  localStorage.clear();
  Object.defineProperty(window.navigator, 'language', { configurable: true, value: 'en-US' });
  Object.defineProperty(window.navigator, 'languages', { configurable: true, value: ['en-US'] });
});

afterEach(() => {
  (urls.apiV1Base as jest.Mock | undefined)?.mockRestore?.();
});

test('registered serial shows topic-scoped mqtt row and never calls global GET /hard-data', async () => {
  global.fetch = jest.fn().mockImplementation((url: string) => {
    expect(url).toMatch(/\/hard-data\/hw\/SN001$/);
    expect(url).not.toMatch(/\/hard-data$/);
    return Promise.resolve({
      ok: true,
      status: 200,
      json: async () => ({ serial: 'SN001', topic: 'serpico/hard-data/hw/SN001', records: [mqttRow] }),
    });
  }) as jest.Mock;

  renderHandle('SN001');
  expect((await screen.findAllByText('serpico/hard-data/hw/SN001')).length).toBeGreaterThan(0);
  expect(screen.getByText('mqtt')).toBeInTheDocument();
  expect(screen.getByText('unit 12 on scene')).toBeInTheDocument();
  expect(screen.getByText('https://serpico.onrender.com/x-hard-data/hw/SN001')).toBeInTheDocument();
  expect(screen.queryByText('other-topic')).not.toBeInTheDocument();
});

test('unregistered serial shows not-found without other topics', async () => {
  global.fetch = jest.fn().mockImplementation((url: string) => {
    expect(url).toMatch(/\/hard-data\/hw\/NOTREGISTERED$/);
    return Promise.resolve({
      ok: false,
      status: 404,
      json: async () => ({ error: 'hardware not found' }),
    });
  }) as jest.Mock;

  renderHandle('NOTREGISTERED');
  expect(await screen.findByText(/This serial is not registered/i)).toBeInTheDocument();
  expect(screen.queryByText('other-topic')).not.toBeInTheDocument();
  expect(screen.queryByText('serpico/hard-data/demo')).not.toBeInTheDocument();
  expect(screen.queryByText('mqtt')).not.toBeInTheDocument();
});

test('language toggle switches handle table headers to Simplified Chinese', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ serial: 'SN001', topic: 'serpico/hard-data/hw/SN001', records: [mqttRow] }),
  }) as jest.Mock;

  renderHandle('sn001');
  expect((await screen.findAllByText('serpico/hard-data/hw/SN001')).length).toBeGreaterThan(0);
  expect(screen.getByRole('columnheader', { name: /When/i })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: '中文' }));
  expect(await screen.findByText('硬件数据')).toBeInTheDocument();
  expect(screen.getByRole('columnheader', { name: '时间' })).toBeInTheDocument();
  expect(screen.getByRole('columnheader', { name: '来源' })).toBeInTheDocument();
  expect(screen.getByRole('columnheader', { name: '主题' })).toBeInTheDocument();
  expect(screen.getByRole('columnheader', { name: '载荷' })).toBeInTheDocument();
  expect(screen.getAllByText('serpico/hard-data/hw/SN001').length).toBeGreaterThan(0);
});
