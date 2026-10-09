import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import App from './App';

jest.mock('leaflet/dist/leaflet.css', () => ({}));
jest.mock('leaflet', () => ({
  divIcon: () => ({}),
}));
jest.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="world-map">{children}</div>,
  TileLayer: () => null,
  Marker: () => null,
  Popup: () => null,
}));

jest.mock('./hooks/useHealthCheck', () => ({
  useHealthCheck: () => undefined,
}));

jest.mock('./pages/Dashboard', () => () => <div>Officer dashboard</div>);

jest.mock('./services/api', () => ({
  usersAPI: {
    getMe: jest.fn(() => Promise.resolve({ user: {} })),
    upsertNation: jest.fn(() => Promise.resolve()),
  },
  authAPI: {
    login: jest.fn(),
    redeem: jest.fn(),
  },
}));

beforeEach(() => {
  localStorage.clear();
  window.history.pushState({}, '', '/');
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ posts: [], visits: [], palette: [] }),
  }) as unknown as typeof fetch;
});

test('unauthenticated / is the public landing not login', async () => {
  render(<App />);
  expect(await screen.findByRole('heading', { name: 'SERPICO' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Open email to Ge/i })).toBeInTheDocument();
  expect(screen.queryByText(/Quick Deploy/i)).not.toBeInTheDocument();
});

test('unauthenticated /join is not redirected to login', async () => {
  window.history.pushState({}, '', '/join');
  render(<App />);
  expect(await screen.findByRole('heading', { name: /Enter invitation/i })).toBeInTheDocument();
  expect(screen.queryByText(/Quick Deploy/i)).not.toBeInTheDocument();
});

test('authenticated / shows the officer dashboard', async () => {
  localStorage.setItem(
    'user',
    JSON.stringify({
      id: 'demo-serpico',
      email: 'serpico',
      name: 'Officer Serpico',
      role: 'police',
    })
  );
  render(<App />);
  expect(await screen.findByText('Officer dashboard')).toBeInTheDocument();
});

test('unauthenticated /shuileme/chat is 睡了么 chat inside the lounge, not officer chrome', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ beds: [], bedrooms: [], articles: [] }),
  });
  window.history.pushState({}, '', '/shuileme/chat');
  render(<App />);
  expect(await screen.findByRole('heading', { name: '睡了么' })).toBeInTheDocument();
  expect(screen.getByRole('textbox').tagName).toBe('TEXTAREA');
  expect(screen.queryByText('Officer dashboard')).not.toBeInTheDocument();
  expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  expect(window.location.pathname).toBe('/shuileme/chat');
});

test('unauthenticated /agent-skill is the public MCP skill, not officer chrome', async () => {
  window.history.pushState({}, '', '/agent-skill');
  render(<App />);
  expect(await screen.findByRole('heading', { name: '公开特工技能' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: '安装到 Cursor' })).toBeInTheDocument();
  expect(screen.queryByText(/Quick Deploy/i)).not.toBeInTheDocument();
  expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  expect(window.location.pathname).toBe('/agent-skill');
});

test('unauthenticated /travel is the agent map, not officer chrome', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ posts: [] }),
  });
  window.history.pushState({}, '', '/travel');
  render(<App />);
  expect(await screen.findByRole('heading', { name: 'Agent travel' })).toBeInTheDocument();
  expect(screen.queryByText(/Quick Deploy/i)).not.toBeInTheDocument();
  expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  expect(window.location.pathname).toBe('/travel');
});

test('unauthenticated /xiaomaomi/visitors is the guest book, not officer chrome', async () => {
  window.history.pushState({}, '', '/xiaomaomi/visitors');
  render(<App />);
  expect(await screen.findByRole('heading', { name: '谁坐过' })).toBeInTheDocument();
  expect(screen.queryByText(/Quick Deploy/i)).not.toBeInTheDocument();
  expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  expect(window.location.pathname).toBe('/xiaomaomi/visitors');
});

test('unauthenticated /xiaomaomi is 小茂密咖啡, not officer chrome', async () => {
  window.history.pushState({}, '', '/xiaomaomi');
  render(<App />);
  expect(await screen.findByRole('heading', { name: '小茂密咖啡' })).toBeInTheDocument();
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  expect(screen.queryByText('Officer dashboard')).not.toBeInTheDocument();
  expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  expect(window.location.pathname).toBe('/xiaomaomi');
});
