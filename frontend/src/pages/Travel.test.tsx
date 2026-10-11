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

test('the story opens as a full overlay modal that scrolls inside', async () => {
  render(<Travel />);
  await userEvent.click(await screen.findByRole('button', { name: /Tram morning/ }));
  const sheet = document.querySelector('.tr-sheet');
  const bar = sheet?.querySelector('.tr-sheet-bar');
  const scroll = sheet?.querySelector('.tr-sheet-scroll');
  expect(bar?.querySelector('button.tr-close')).toBeTruthy();
  expect(scroll?.querySelector('.tr-body')?.textContent).toBe(longBody);
  expect(sheet?.innerHTML.indexOf('tr-sheet-bar')).toBeLessThan(sheet?.innerHTML.indexOf('tr-sheet-scroll') || 0);
  const src = readFileSync(join(__dirname, 'Travel.tsx'), 'utf8');
  expect(src).not.toMatch(/visualViewport/);
  const css = readFileSync(join(__dirname, '../index.css'), 'utf8');
  const sheetCss = css.slice(css.indexOf('.tr-sheet-backdrop'));
  const backdropRule = sheetCss.match(/\.tr-sheet-backdrop\s*\{[^}]*\}/)?.[0] || '';
  const sheetRule = sheetCss.match(/\.tr-sheet\s*\{[^}]*\}/)?.[0] || '';
  expect(backdropRule).toMatch(/top:\s*0/);
  expect(backdropRule).toMatch(/left:\s*0/);
  expect(backdropRule).toMatch(/right:\s*0/);
  expect(backdropRule).toMatch(/height:\s*100vh/);
  expect(backdropRule).toMatch(/100lvh/);
  expect(backdropRule).not.toMatch(/inset:/);
  expect(backdropRule).not.toMatch(/height:\s*auto/);
  expect(backdropRule).not.toMatch(/100dvh/);
  expect(backdropRule).toMatch(/align-items:\s*center/);
  expect(backdropRule).toMatch(/justify-content:\s*center/);
  expect(backdropRule).toMatch(/padding:/);
  expect(backdropRule).not.toMatch(/flex-end/);
  expect(sheetRule).toMatch(/height:\s*100%/);
  expect(sheetRule).toMatch(/min-height:\s*0/);
  expect(sheetRule).toMatch(/overflow:\s*auto/);
  expect(sheetRule).toMatch(/border-radius:\s*1\.25rem;/);
  expect(sheetRule).not.toMatch(/1\.25rem 1\.25rem 0 0/);
  expect(sheetCss).toMatch(/\.tr-sheet-bar\s*\{[^}]*position:\s*sticky/);
  expect(sheetCss).toMatch(/\.tr-sheet-bar\s*\{[^}]*top:\s*0/);
  const scrollRule = sheetCss.match(/\.tr-sheet-scroll\s*\{[^}]*\}/)?.[0] || '';
  expect(scrollRule).not.toMatch(/overflow:/);
  expect(scrollRule).not.toMatch(/max-height:/);
  expect(sheetCss).toMatch(/safe-area-inset-bottom/);
  expect(css).toMatch(/\.tr-sheet \.tr-pixel\s*\{[^}]*border:/);
});

test('opening a post locks body scroll without trapping the overlay on html', async () => {
  render(<Travel />);
  await userEvent.click(await screen.findByRole('button', { name: /Tram morning/ }));
  expect(document.body.style.overflow).toBe('hidden');
  expect(document.documentElement.style.overflow).not.toBe('hidden');
  const src = readFileSync(join(__dirname, 'Travel.tsx'), 'utf8');
  expect(src).not.toMatch(/visualViewport/);
  expect(src).toMatch(/document\.body\.style\.overflow = 'hidden'/);
  expect(src).not.toMatch(/documentElement[\s\S]{0,80}overflow = 'hidden'/);
  const css = readFileSync(join(__dirname, '../index.css'), 'utf8');
  const lounge = css.slice(css.indexOf('html.tr-world'));
  expect(lounge).toMatch(/min-height:\s*100lvh/);
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
  expect(sheetRule).toMatch(/height:\s*100%/);
  expect(sheetRule).toMatch(/min-height:\s*0/);
  expect(sheetRule).toMatch(/overflow:\s*auto/);
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
