import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import HardDataDocs from './HardDataDocs';

beforeEach(() => {
  localStorage.clear();
  Object.defineProperty(window.navigator, 'language', { configurable: true, value: 'en-US' });
  Object.defineProperty(window.navigator, 'languages', { configurable: true, value: ['en-US'] });
  window.history.replaceState({}, '', '/x-hard-data');
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ records: [] }),
  }) as jest.Mock;
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
});

test('language toggle switches the unlisted page to Simplified Chinese', async () => {
  render(<HardDataDocs />);
  expect(await screen.findByText(/Hard data ingest/i)).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: '中文' }));
  expect(await screen.findByText('硬数据接入')).toBeInTheDocument();
  expect(screen.getByText('HTTP 接口')).toBeInTheDocument();
  expect(screen.getByText('MQTT（直连）')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '提交样例' })).toBeInTheDocument();
  expect(screen.getByText(/暂无硬数据/)).toBeInTheDocument();
  expect(screen.getAllByText('wss://serpicoproject.onrender.com/mqtt').length).toBeGreaterThan(0);
});
