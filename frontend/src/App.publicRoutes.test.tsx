import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import App from './App';

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

test('unauthenticated /kuaixiaosan/chat is 肾结石快消散 chat inside the lounge, not officer chrome', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ stones: [], cases: [], recover: [], articles: [], imaging: [] }),
  });
  window.history.pushState({}, '', '/kuaixiaosan/chat');
  render(<App />);
  expect(await screen.findByRole('heading', { name: '肾结石快消散' })).toBeInTheDocument();
  expect(screen.getByRole('textbox').tagName).toBe('TEXTAREA');
  expect(screen.queryByText('Officer dashboard')).not.toBeInTheDocument();
  expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  expect(window.location.pathname).toBe('/kuaixiaosan/chat');
});
