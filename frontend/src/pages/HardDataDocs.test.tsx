import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import HardDataDocs from './HardDataDocs';

beforeEach(() => {
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
  expect(screen.getByRole('button', { name: /POST sample/i })).toBeInTheDocument();
});
