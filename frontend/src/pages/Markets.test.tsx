import '@testing-library/jest-dom';
import { readFileSync } from 'fs';
import { join } from 'path';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Markets from './Markets';

const notes = [
  {
    id: 'etf',
    kind: 'tape',
    agentName: 'Grok',
    title: 'SPY week',
    body: 'The tape firmed.\n\nSecond paragraph.',
    region: 'us',
    instrumentKind: 'etf',
    symbol: 'SPY',
    stance: 'firmer',
    horizon: 'weeks',
    points: [
      { t: '2026-10-01', v: 100 },
      { t: '2026-10-02', v: 110 },
    ],
    beats: [],
  },
  {
    id: 'pol',
    kind: 'policy',
    agentName: 'Grok',
    title: 'Rate path',
    body: 'Watch the statement.',
    region: 'cn',
    instrumentKind: '',
    symbol: '',
    stance: '',
    horizon: '',
    points: [],
    beats: [
      { date: '2026-09-01', text: 'Statement' },
      { date: '2026-10-01', text: 'Follow-up' },
    ],
  },
];

function renderDesk(path = '/markets') {
  window.history.pushState({}, '', path);
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/markets" element={<Markets />} />
        <Route path="/markets/:id" element={<Markets />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.clear();
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ notes }),
  }) as unknown as typeof fetch;
});

test('the desk draws an ETF line, dates a policy, and a filter hides the other kind', async () => {
  renderDesk();
  expect(await screen.findByRole('heading', { name: 'Market desk' })).toBeInTheDocument();
  expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  expect(screen.queryByText(/Quick Deploy/i)).not.toBeInTheDocument();
  const list = document.querySelector('.mk-list') as HTMLElement;
  expect((await within(list).findByText('SPY week')).closest('a')?.querySelector('svg.mk-line')).toBeTruthy();
  const policy = within(list).getByText('Rate path').closest('a') as HTMLElement;
  expect(policy.querySelector('svg')).toBeNull();
  expect(policy).toHaveTextContent('2026-09-01');
  expect(policy).toHaveTextContent('Follow-up');
  await userEvent.click(screen.getByRole('button', { name: 'Policy' }));
  expect(within(list).queryByText('SPY week')).not.toBeInTheDocument();
  expect(within(list).getByText('Rate path')).toBeInTheDocument();
  const spa = readFileSync(join(__dirname, '../../scripts/spa-routes.js'), 'utf8');
  expect(spa).toMatch(/'markets'/);
});

test('a note URL is a page with the full body and no sheet', async () => {
  renderDesk('/markets/etf');
  expect(await screen.findByRole('heading', { name: 'SPY week' })).toBeInTheDocument();
  const body = document.querySelector('.mk-body');
  expect(body?.textContent).toBe('The tape firmed.\n\nSecond paragraph.');
  expect(screen.getByText('Grok')).toBeInTheDocument();
  expect(document.querySelector('svg.mk-line-lg')).toBeTruthy();
  expect(screen.getByText(/not a recommendation to buy or sell/i)).toBeInTheDocument();
  const src = readFileSync(join(__dirname, 'Markets.tsx'), 'utf8');
  expect(src).not.toMatch(/role="dialog"|tr-sheet|mk-sheet/);
  expect(window.location.pathname).toBe('/markets/etf');
});
