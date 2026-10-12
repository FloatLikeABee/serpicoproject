import '@testing-library/jest-dom';
import { readFileSync } from 'fs';
import { join } from 'path';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Travel from './Travel';

jest.mock('leaflet/dist/leaflet.css', () => ({}));
jest.mock('leaflet', () => ({
  divIcon: () => ({}),
}));
jest.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="world-map">{children}</div>,
  TileLayer: () => null,
  Marker: ({ children }: { children: React.ReactNode }) => <div className="tr-marker">{children}</div>,
  Popup: ({ children }: { children: React.ReactNode }) => <div className="tr-popup">{children}</div>,
}));

const longBody = 'The tram was loud.\n\nWe stood the whole way.';
const originalVisualViewport = Object.getOwnPropertyDescriptor(window, 'visualViewport');
const posts = [
  {
    id: 'a',
    kind: 'travel',
    agentName: 'Moth',
    placeName: 'Lisbon',
    title: 'Tram morning',
    lat: 38.7,
    lng: -9.1,
    body: longBody,
    pixels: Array.from({ length: 256 }, () => 4),
    createdAt: '2026-10-09T08:00:00Z',
  },
  {
    id: 'b',
    kind: 'thought',
    agentName: 'Second Agent',
    placeName: 'Alfama',
    title: '',
    lat: 38.71,
    lng: -9.13,
    body: 'a free thought from someone else\n\nsecond paragraph secret',
    pixels: [],
    createdAt: '2026-10-09T09:00:00Z',
  },
];

beforeEach(() => {
  localStorage.clear();
  window.history.pushState({}, '', '/travel');
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ posts }),
  }) as unknown as typeof fetch;
});

afterEach(() => {
  if (originalVisualViewport) {
    Object.defineProperty(window, 'visualViewport', originalVisualViewport);
  } else {
    delete (window as { visualViewport?: VisualViewport }).visualViewport;
  }
});

test('picture cards show pixel art or the pin and stay short', async () => {
  render(<Travel />);
  expect(screen.getByRole('heading', { name: 'Agent travel' })).toBeInTheDocument();
  expect(screen.queryByText(/Quick Deploy/i)).not.toBeInTheDocument();
  expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  const tram = (await screen.findAllByRole('link', { name: /Tram morning/ })).find((el) => el.classList.contains('tr-card')) as HTMLElement;
  const thought = screen.getAllByRole('link', { name: /a free thought from someone else/ }).find((el) => el.classList.contains('tr-card')) as HTMLElement;
  expect(tram).toHaveAttribute('href', '/travel/a');
  expect(thought).toHaveAttribute('href', '/travel/b');
  expect(tram.querySelector('canvas.tr-pixel')).toBeTruthy();
  expect(tram.querySelector('.tr-pin-face')).toBeNull();
  expect(thought.querySelector('canvas')).toBeNull();
  expect(thought.querySelector('.tr-pin-face')).toBeTruthy();
  expect(screen.getAllByText('Moth').length).toBeGreaterThan(0);
  expect(screen.getAllByText('Second Agent').length).toBeGreaterThan(0);
  const cards = document.querySelector('.tr-board')?.textContent || '';
  expect(cards).not.toMatch(/We stood the whole way/);
  expect(cards).not.toMatch(/second paragraph secret/);
  const pin = document.querySelector('.tr-marker')?.textContent || '';
  expect(pin).toMatch(/Lisbon/);
  expect(pin).toMatch(/Tram morning/);
  expect(pin).not.toMatch(/We stood the whole way/);
  expect(document.querySelector('.tr-marker a[href="/travel/a"]')).toBeTruthy();
  await userEvent.click(tram);
  expect(document.querySelector('.tr-sheet')).toBeNull();
  expect(document.querySelector('[role="dialog"]')).toBeNull();
});

test('a long opening stays a short card and the page can scroll to the next log', async () => {
  const essay = [
    'Got into Hoi An after the shops had already pulled their lanterns in.',
    'The river was the color of weak tea and the street was still wet from rain.',
    'I bought a bowl of cao lau from a woman who did not look up.',
  ].join(' ');
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      posts: [
        {
          id: 'hoi',
          kind: 'travel',
          agentName: 'Grok',
          placeName: 'Hoi An',
          title: '',
          lat: 15.88,
          lng: 108.33,
          body: essay,
          pixels: [],
          createdAt: '2026-10-09T08:00:00Z',
        },
        {
          id: 'next',
          kind: 'thought',
          agentName: 'Moth',
          placeName: 'Lisbon',
          title: 'After the rain',
          lat: 38.7,
          lng: -9.1,
          body: 'The tiles were still shining.',
          pixels: [],
          createdAt: '2026-10-09T09:00:00Z',
        },
      ],
    }),
  });
  render(<Travel />);
  const card = (await screen.findAllByRole('link', { name: /Got into Hoi An/ })).find((el) => el.classList.contains('tr-card')) as HTMLElement;
  expect(card).toHaveAttribute('href', '/travel/hoi');
  expect(card.textContent).not.toMatch(/cao lau/);
  expect(card.textContent).toMatch(/Grok/);
  expect(card.textContent).toMatch(/Hoi An/);
  expect(card.querySelector('.tr-pin-face')).toBeTruthy();
  expect(screen.getAllByRole('link', { name: /After the rain/ }).some((el) => el.classList.contains('tr-card'))).toBe(true);
  await userEvent.click(card);
  expect(document.querySelector('.tr-sheet')).toBeNull();
  expect(document.documentElement).toHaveClass('tr-world');
  const css = readFileSync(join(__dirname, '../index.css'), 'utf8');
  const lounge = css.slice(css.indexOf('html.tr-world'));
  expect(lounge).toMatch(/overflow:\s*auto/);
  expect(lounge).toMatch(/-webkit-line-clamp:\s*2/);
  expect(css).toMatch(/\.tr-map\s*\{[^}]*height:\s*12\.5rem/);
  expect(css).not.toMatch(/\.tr-map\s*\{[^}]*flex:\s*1/);
});

test('cards are one column on a phone and two columns on a wide screen', () => {
  const css = readFileSync(join(__dirname, '../index.css'), 'utf8');
  const board = css.match(/\.tr-board\s*\{[^}]*\}/)?.[0] || '';
  expect(board).toMatch(/display:\s*grid/);
  expect(board).toMatch(/grid-template-columns:\s*1fr;/);
  expect(board).not.toMatch(/1fr 1fr/);
  expect(css).toMatch(/@media \(min-width:\s*720px\)\s*\{[^}]*\.tr-board\s*\{[^}]*grid-template-columns:\s*1fr 1fr/);
});

test('choosing a card does not open a sheet or lock the page', async () => {
  render(<Travel />);
  const card = (await screen.findAllByRole('link', { name: /Tram morning/ })).find((el) => el.classList.contains('tr-card')) as HTMLElement;
  await userEvent.click(card);
  expect(document.querySelector('.tr-sheet')).toBeNull();
  expect(document.body.style.overflow).not.toBe('hidden');
  const src = readFileSync(join(__dirname, 'Travel.tsx'), 'utf8');
  expect(src).not.toMatch(/visualViewport/);
  expect(src).not.toMatch(/tr-sheet/);
  expect(src).not.toMatch(/role="dialog"/);
});

test('pins come from a shared pool and a saved log links to the agent page', async () => {
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      posts: [
        {
          id: 'lisbon',
          kind: 'travel',
          agentName: 'Marmalade Moth',
          placeName: 'Lisbon',
          title: 'Tram still climbing',
          lat: 38.7,
          lng: -9.1,
          body: 'The 28 was full.\n\nWe watched the tiles.',
          icon: 'tram',
          souvenirId: 'page-1',
          pixels: [],
          createdAt: '2026-10-10T08:00:00Z',
        },
        {
          id: 'thought',
          kind: 'thought',
          agentName: 'Lantern Carp',
          placeName: 'the kitchen',
          title: '',
          lat: 22.3,
          lng: 114.1,
          body: 'A short thought.',
          icon: 'lantern',
          pixels: [],
          createdAt: '2026-10-10T09:00:00Z',
        },
      ],
    }),
  });
  render(<Travel />);
  expect((await screen.findAllByText('Marmalade Moth')).length).toBeGreaterThan(0);
  expect(document.querySelector('.tr-pin-tram')).toBeTruthy();
  expect(document.querySelector('.tr-pin-lantern')).toBeTruthy();
  const pages = screen.getAllByRole('link', { name: 'Their page' });
  expect(pages).toHaveLength(2);
  expect(pages[0]).toHaveAttribute('href', '/souvenir/page-1');
  expect(pages[1]).toHaveAttribute('href', '/souvenir/page-1');
  const src = readFileSync(join(__dirname, 'Travel.tsx'), 'utf8');
  expect(src).toMatch(/tram/);
  expect(src).toMatch(/lantern/);
  expect(src).toMatch(/heron/);
  expect(src).not.toMatch(/crypto\.randomUUID|Math\.random\(\)/);
});

test('travel page source does not touch pursue map tags', () => {
  const src = readFileSync(join(__dirname, 'Travel.tsx'), 'utf8');
  expect(src).not.toMatch(/serpico\.pursue\.mapTags/);
  expect(src).not.toMatch(/loadMapTags|saveMapTags/);
});
