import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Landing from './Landing';

function renderLanding() {
  return render(
    <MemoryRouter>
      <Landing />
    </MemoryRouter>
  );
}

test('landing introduces Serpico and blocks incomplete invite mail', async () => {
  renderLanding();
  expect(screen.getByRole('heading', { name: 'SERPICO' })).toBeInTheDocument();
  expect(screen.getByText(/Officer desk/i)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /I have a code/i })).toHaveAttribute('href', '/join');
  expect(screen.getByRole('link', { name: /Sign in/i })).toHaveAttribute('href', '/login');

  await userEvent.click(screen.getByRole('button', { name: /Open email to Ge/i }));
  expect(screen.getByText(/self-introduction are required/i)).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: /ge\.gao\.0039@gmail\.com/i })).not.toBeInTheDocument();
});

test('complete request shows mailto to Ge with the intro', async () => {
  renderLanding();
  await userEvent.type(screen.getByLabelText(/^Name/i), 'Alex Chen');
  await userEvent.type(screen.getByLabelText(/Who you are/i), 'Independent researcher');
  await userEvent.type(
    screen.getByLabelText(/Why you want access/i),
    'I am a field researcher who wants to try the officer desk, maps, and cases.'
  );
  await userEvent.click(screen.getByRole('button', { name: /Open email to Ge/i }));
  const mail = await screen.findByRole('link', { name: /ge\.gao\.0039@gmail\.com/i });
  expect(mail).toHaveAttribute('href', expect.stringContaining('mailto:ge.gao.0039@gmail.com'));
  expect(mail.getAttribute('href')).toEqual(expect.stringContaining('Alex%20Chen'));
});
