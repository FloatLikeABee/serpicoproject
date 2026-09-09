import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Join from './Join';
import { authAPI } from '../services/api';

jest.mock('../services/api', () => ({
  authAPI: {
    redeem: jest.fn(),
  },
}));

test('join is public and shows the same credentials on two redeems', async () => {
  (authAPI.redeem as jest.Mock).mockResolvedValue({
    username: 'offabc123xyz',
    password: 'GeneratedPass99',
  });

  render(
    <MemoryRouter>
      <Join />
    </MemoryRouter>
  );

  expect(screen.getByRole('heading', { name: /Enter invitation/i })).toBeInTheDocument();
  await userEvent.type(screen.getByLabelText(/Invitation code/i), 'long-invite-code');
  await userEvent.click(screen.getByRole('button', { name: /Reveal credentials/i }));
  expect(await screen.findByText(/offabc123xyz/)).toBeInTheDocument();
  expect(screen.getByText(/GeneratedPass99/)).toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: /Reveal credentials/i }));
  expect(await screen.findByText(/offabc123xyz/)).toBeInTheDocument();
  expect(authAPI.redeem).toHaveBeenCalledTimes(2);
});
