import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

jest.mock('./services/api', () => ({
  API_BASE_URL: 'https://serpicoproject.onrender.com/api/v1',
  adminAPI: {
    login: jest.fn(),
    listHardware: jest.fn().mockResolvedValue({ data: { devices: [] } }),
    registerHardware: jest.fn(),
    getHardware: jest.fn(),
    getHardwareMessages: jest.fn().mockResolvedValue({ data: { records: [] } }),
  },
}));

jest.mock('./hooks/useHealthCheck', () => ({
  useHealthCheck: () => undefined,
}));

beforeEach(() => {
  localStorage.clear();
  window.history.pushState({}, '', '/');
});

test('unauthenticated /hardware visit redirects to login', async () => {
  window.history.pushState({}, '', '/hardware');
  render(<App />);
  expect(await screen.findByText(/Sign in to continue/i)).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: /Hardware registry/i })).not.toBeInTheDocument();
  expect(screen.getByLabelText(/Username/i)).toBeInTheDocument();
});

test('signed-in dashboard shows Hardware registry and opens the register page', async () => {
  localStorage.setItem('adminAuth', 'true');
  render(<App />);
  expect(await screen.findByRole('heading', { name: 'Hardware registry' })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: /Hardware registry/i }));
  expect(await screen.findByRole('heading', { name: 'Hardware registry' })).toBeInTheDocument();
  expect(screen.getByLabelText(/Serial number/i)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Register/i })).toBeInTheDocument();
});
