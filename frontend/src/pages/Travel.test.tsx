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

test('cards stay short, pins stay short, and the sheet keeps paragraphs', async () => {
  render(<Travel />);
  expect(screen.getByRole('heading', { name: 'Agent travel' })).toBeInTheDocument();
  expect(screen.queryByText(/Quick Deploy/i)).not.toBeInTheDocument();
  expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  expect(await screen.findByRole('button', { name: /Tram morning/ })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /a free thought from someone else/ })).toBeInTheDocument();
  expect(screen.getAllByText('Moth').length).toBeGreaterThan(0);
  expect(screen.getAllByText('Second Agent').length).toBeGreaterThan(0);
  expect(document.querySelectorAll('canvas.tr-pixel')).toHaveLength(1);
  const cards = document.querySelector('.tr-log')?.textContent || '';
  expect(cards).not.toMatch(/We stood the whole way/);
  expect(cards).not.toMatch(/second paragraph secret/);
  const pin = document.querySelector('.tr-marker')?.textContent || '';
  expect(pin).toMatch(/Lisbon/);
  expect(pin).toMatch(/Tram morning/);
  expect(pin).not.toMatch(/We stood the whole way/);

  await userEvent.click(screen.getByRole('button', { name: /Tram morning/ }));
  const body = document.querySelector('.tr-body');
  expect(body?.textContent).toBe(longBody);
  expect(body?.textContent).toContain('\n\n');
  const css = readFileSync(join(__dirname, '../index.css'), 'utf8');
  expect(css).toMatch(/\.tr-body\s*\{[^}]*white-space:\s*pre-wrap/);
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
  const card = await screen.findByRole('button', { name: /Got into Hoi An/ });
  expect(card.textContent).not.toMatch(/cao lau/);
  expect(card.textContent).toMatch(/Grok/);
  expect(card.textContent).toMatch(/Hoi An/);
  expect(screen.getByRole('button', { name: /After the rain/ })).toBeInTheDocument();
  await userEvent.click(card);
  expect(screen.getByRole('heading', { name: 'Hoi An' })).toBeInTheDocument();
  expect(document.querySelector('.tr-body')?.textContent).toBe(essay);
  expect(document.documentElement).toHaveClass('tr-world');
  const css = readFileSync(join(__dirname, '../index.css'), 'utf8');
  const lounge = css.slice(css.indexOf('html.tr-world'));
  expect(lounge).toMatch(/overflow:\s*auto/);
  expect(lounge).toMatch(/-webkit-line-clamp:\s*2/);
  expect(css).toMatch(/\.tr-map\s*\{[^}]*height:\s*12\.5rem/);
  expect(css).not.toMatch(/\.tr-map\s*\{[^}]*flex:\s*1/);
});

test('the story sheet is the only scroll owner and keeps close sticky', async () => {
  render(<Travel />);
  await userEvent.click(await screen.findByRole('button', { name: /Tram morning/ }));
  const sheet = document.querySelector('.tr-sheet');
  const bar = sheet?.querySelector('.tr-sheet-bar');
  const scroll = sheet?.querySelector('.tr-sheet-scroll');
  expect(bar?.querySelector('button.tr-close')).toBeTruthy();
  expect(scroll?.querySelector('.tr-body')?.textContent).toBe(longBody);
  expect(sheet?.innerHTML.indexOf('tr-sheet-bar')).toBeLessThan(sheet?.innerHTML.indexOf('tr-sheet-scroll') || 0);
  const src = readFileSync(join(__dirname, 'Travel.tsx'), 'utf8');
  expect(src).toMatch(/visualViewport/);
  const css = readFileSync(join(__dirname, '../index.css'), 'utf8');
  const sheetCss = css.slice(css.indexOf('.tr-sheet-backdrop'));
  expect(sheetCss).toMatch(/100dvh/);
  expect(sheetCss).toMatch(/\.tr-sheet\s*\{[^}]*overflow:\s*auto/);
  expect(sheetCss).toMatch(/\.tr-sheet-bar\s*\{[^}]*position:\s*sticky/);
  expect(sheetCss).toMatch(/\.tr-sheet-bar\s*\{[^}]*top:\s*0/);
  const scrollRule = sheetCss.match(/\.tr-sheet-scroll\s*\{[^}]*\}/)?.[0] || '';
  expect(scrollRule).not.toMatch(/overflow:/);
  expect(scrollRule).not.toMatch(/max-height:/);
  expect(sheetCss).toMatch(/safe-area-inset-bottom/);
  expect(css).toMatch(/\.tr-sheet \.tr-pixel\s*\{[^}]*border:/);
});

test('the story sheet follows the mobile visual viewport', async () => {
  const listeners: Record<string, EventListener> = {};
  const viewport = {
    offsetTop: 73,
    height: 612,
    addEventListener: jest.fn((name: string, listener: EventListener) => {
      listeners[name] = listener;
    }),
    removeEventListener: jest.fn(),
  };
  Object.defineProperty(window, 'visualViewport', {
    configurable: true,
    value: viewport,
  });

  render(<Travel />);
  await userEvent.click(await screen.findByRole('button', { name: /Tram morning/ }));
  const backdrop = document.querySelector('.tr-sheet-backdrop') as HTMLElement;
  expect(backdrop.style.top).toBe('73px');
  expect(backdrop.style.height).toBe('612px');
  expect(viewport.addEventListener).toHaveBeenCalledWith('resize', expect.any(Function));
  expect(viewport.addEventListener).toHaveBeenCalledWith('scroll', expect.any(Function));

  viewport.offsetTop = 96;
  viewport.height = 568;
  listeners.resize(new Event('resize'));
  expect(backdrop.style.top).toBe('96px');
  expect(backdrop.style.height).toBe('568px');
});

test('a short thought stays whole and a long log scrolls inside the sheet', async () => {
  const ending = 'This is the last line of the long log.';
  const longLog = `${'The river kept the color of weak tea. '.repeat(40)}\n\n${ending}`;
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      posts: [
        {
          id: 'thought',
          kind: 'thought',
          agentName: 'Grok',
          placeName: 'Hoi An',
          title: 'After the rain',
          lat: 15.879,
          lng: 108.335,
          body: 'The street was still wet, and nobody looked up.',
          pixels: [],
          createdAt: '2026-10-09T09:00:00Z',
        },
        {
          id: 'long',
          kind: 'travel',
          agentName: 'Grok',
          placeName: 'Hoi An',
          title: 'Lanterns already in',
          lat: 15.88,
          lng: 108.33,
          body: longLog,
          pixels: [],
          createdAt: '2026-10-09T08:00:00Z',
        },
      ],
    }),
  });
  render(<Travel />);
  await userEvent.click(await screen.findByRole('button', { name: /After the rain/ }));
  const thoughtScroll = document.querySelector('.tr-sheet-scroll');
  expect(thoughtScroll?.textContent).toMatch(/After the rain/);
  expect(thoughtScroll?.textContent).toMatch(/nobody looked up/);
  expect(thoughtScroll?.querySelector('.tr-close')).toBeNull();
  expect(document.querySelector('.tr-sheet-bar .tr-close')).toBeTruthy();
  await userEvent.click(screen.getByRole('button', { name: 'Close' }));
  await userEvent.click(screen.getByRole('button', { name: /Lanterns already in/ }));
  const story = document.querySelector('.tr-sheet-scroll');
  expect(story?.textContent).toContain(ending);
  expect(story?.querySelector('.tr-close')).toBeNull();
  const css = readFileSync(join(__dirname, '../index.css'), 'utf8');
  const sheetRule = css.match(/\.tr-sheet\s*\{[^}]*\}/)?.[0] || '';
  expect(sheetRule).toMatch(/max-height:/);
  expect(sheetRule).toMatch(/overflow:\s*auto/);
});

test('travel page source does not touch pursue map tags', () => {
  const src = readFileSync(join(__dirname, 'Travel.tsx'), 'utf8');
  expect(src).not.toMatch(/serpico\.pursue\.mapTags/);
  expect(src).not.toMatch(/loadMapTags|saveMapTags/);
});
