import '@testing-library/jest-dom';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FridgeRaid from './FridgeRaid';

const fixture = {
  season: 'summer',
  solarTerm: '大暑',
  locale: 'en',
  disclaimer: 'Culinary TCM-inspired ideas, not medical advice.',
  suggestions: [
    {
      title: 'Tomato egg stir-fry',
      hook: 'Sweet-tart tomatoes hugging silky eggs.',
      chips: ['开胃', '15 min'],
      tcmNote: 'Tomato is cooling in summer heat. Eggs are gentle.',
      uses: ['tomato', 'egg'],
    },
    {
      title: 'Cold tomato noodles',
      hook: 'Chilled, sour-savory slip.',
      chips: ['清热'],
      tcmNote: 'Raw tomato clears heat.',
      uses: ['tomato'],
    },
    {
      title: 'Egg drop with ginger',
      hook: 'Peppery steam, soft ribbons.',
      chips: ['开胃'],
      tcmNote: 'Ginger wakes the appetite.',
      uses: ['egg'],
    },
  ],
};

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  Object.defineProperty(window.navigator, 'language', { configurable: true, value: 'en-US' });
  Object.defineProperty(window.navigator, 'geolocation', {
    configurable: true,
    value: {
      getCurrentPosition: (_ok: unknown, err: (e: GeolocationPositionError) => void) => {
        err({ code: 1, message: 'denied' } as GeolocationPositionError);
      },
    },
  });
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => fixture,
  }) as jest.Mock;
});

test('fresh visit shows a short fridge-raid opening and disclaimer', () => {
  render(<FridgeRaid />);
  expect(screen.getByText('Fridge Raid')).toBeInTheDocument();
  expect(screen.getByText(/raid the fridge/i)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Photo' })).toBeInTheDocument();
  expect(screen.getByText(/not medical/i)).toBeInTheDocument();
  expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  expect(document.querySelector('.synth-grid-bg')).toBeNull();
});

test('language toggle switches chrome to Simplified Chinese', async () => {
  render(<FridgeRaid />);
  await userEvent.click(screen.getByRole('button', { name: '中文' }));
  expect(screen.getByText('翻冰箱')).toBeInTheDocument();
  expect(screen.getByPlaceholderText(/冰箱/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '发送' })).toBeInTheDocument();
});

test('typed leftovers render at most four colorful cards with TCM collapsed', async () => {
  render(<FridgeRaid />);
  await userEvent.type(screen.getByPlaceholderText(/fridge/i), 'eggs, tomatoes');
  await userEvent.click(screen.getByRole('button', { name: 'Send' }));
  await waitFor(() => {
    expect(screen.getByText('Tomato egg stir-fry')).toBeInTheDocument();
  });
  const cards = screen.getAllByTestId('fridge-raid-card');
  expect(cards.length).toBeGreaterThanOrEqual(2);
  expect(cards.length).toBeLessThanOrEqual(4);
  expect(screen.queryByText(/Tomato is cooling/)).not.toBeInTheDocument();
  await userEvent.click(within(cards[0]).getByRole('button', { name: /why this season/i }));
  expect(screen.getByText(/Tomato is cooling/)).toBeInTheDocument();
});
