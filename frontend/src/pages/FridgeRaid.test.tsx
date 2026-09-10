import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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

const detailFixture = {
  title: 'Tomato egg stir-fry',
  titleAlias: '番茄炒蛋',
  steps: ['Heat the wok', 'Scramble the eggs', 'Add tomatoes'],
  tasteNote: 'Sweet-tart and silky.',
  tcm: {
    nature: 'cooling',
    flavors: ['sweet', 'sour'],
    goodFor: ['summer heat', 'appetite'],
    caution: ['go easy on icy drinks after'],
  },
  disclaimer: 'Culinary TCM-inspired ideas, not medical advice.',
  locale: 'en',
};

function mockFridgeRaidFetch() {
  return jest.fn().mockImplementation((url: RequestInfo) => {
    const href = String(url);
    if (href.includes('/fridge-raid/detail')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => detailFixture,
      });
    }
    return Promise.resolve({
      ok: true,
      status: 200,
      json: async () => fixture,
    });
  }) as jest.Mock;
}

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
  global.fetch = mockFridgeRaidFetch();
});

async function sendLeftovers() {
  render(<FridgeRaid />);
  await userEvent.type(screen.getByPlaceholderText(/fridge/i), 'eggs, tomatoes');
  await userEvent.click(screen.getByRole('button', { name: 'Send' }));
  await waitFor(() => {
    expect(screen.getByText('Tomato egg stir-fry')).toBeInTheDocument();
  });
}

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
  await sendLeftovers();
  const cards = screen.getAllByTestId('fridge-raid-card');
  expect(cards.length).toBeGreaterThanOrEqual(2);
  expect(cards.length).toBeLessThanOrEqual(4);
  expect(screen.queryByText(/Tomato is cooling/)).not.toBeInTheDocument();
  await userEvent.click(within(cards[0]).getByRole('button', { name: /why this season/i }));
  expect(screen.getByText(/Tomato is cooling/)).toBeInTheDocument();
});

test('tapping a suggestion card opens a kitchen dialog named by the dish', async () => {
  await sendLeftovers();
  await userEvent.click(screen.getByRole('heading', { name: 'Tomato egg stir-fry' }));
  const dialog = await screen.findByRole('dialog', { name: 'Tomato egg stir-fry' });
  expect(dialog).toHaveClass('fr-modal');
  expect(await within(dialog).findByText('Heat the wok')).toBeInTheDocument();
  expect(within(dialog).getByText(/summer heat/)).toBeInTheDocument();
  expect(within(dialog).getByText(/not medical/i)).toBeInTheDocument();
  expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  expect(document.querySelector('.synth-grid-bg')).toBeNull();
});

test('TCM peek on a card does not open the dish dialog', async () => {
  await sendLeftovers();
  const cards = screen.getAllByTestId('fridge-raid-card');
  await userEvent.click(within(cards[0]).getByRole('button', { name: /why this season/i }));
  expect(screen.getByText(/Tomato is cooling/)).toBeInTheDocument();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.queryByText('Heat the wok')).not.toBeInTheDocument();
});

test('reopening the same dish uses the session cache instead of fetching again', async () => {
  await sendLeftovers();
  await userEvent.click(screen.getByRole('heading', { name: 'Tomato egg stir-fry' }));
  const dialog = await screen.findByRole('dialog', { name: 'Tomato egg stir-fry' });
  expect(await within(dialog).findByText('Heat the wok')).toBeInTheDocument();
  const detailCalls = () =>
    (global.fetch as jest.Mock).mock.calls.filter(([url]) => String(url).includes('/fridge-raid/detail'));
  expect(detailCalls()).toHaveLength(1);
  await userEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('heading', { name: 'Tomato egg stir-fry' }));
  const again = await screen.findByRole('dialog', { name: 'Tomato egg stir-fry' });
  expect(within(again).getByText('Heat the wok')).toBeInTheDocument();
  expect(detailCalls()).toHaveLength(1);
});

test('Escape, backdrop, and close dismiss the kitchen dialog', async () => {
  await sendLeftovers();
  await userEvent.click(screen.getByRole('heading', { name: 'Tomato egg stir-fry' }));
  expect(await screen.findByRole('dialog', { name: 'Tomato egg stir-fry' })).toBeInTheDocument();
  await userEvent.keyboard('{Escape}');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

  await userEvent.click(screen.getByRole('heading', { name: 'Tomato egg stir-fry' }));
  expect(await screen.findByRole('dialog', { name: 'Tomato egg stir-fry' })).toBeInTheDocument();
  fireEvent.click(screen.getByTestId('fridge-raid-modal-backdrop'));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

  await userEvent.click(screen.getByRole('heading', { name: 'Tomato egg stir-fry' }));
  const dialog = await screen.findByRole('dialog', { name: 'Tomato egg stir-fry' });
  await userEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Send' })).toBeEnabled();
});

test('Simplified Chinese fridge raid shows Chinese dialog chrome', async () => {
  render(<FridgeRaid />);
  await userEvent.click(screen.getByRole('button', { name: '中文' }));
  await userEvent.type(screen.getByPlaceholderText(/冰箱/), '鸡蛋番茄');
  await userEvent.click(screen.getByRole('button', { name: '发送' }));
  await waitFor(() => {
    expect(screen.getByText('Tomato egg stir-fry')).toBeInTheDocument();
  });
  await userEvent.click(screen.getByRole('heading', { name: 'Tomato egg stir-fry' }));
  const dialog = await screen.findByRole('dialog', { name: 'Tomato egg stir-fry' });
  expect(within(dialog).getByRole('button', { name: '关闭' })).toBeInTheDocument();
  expect(await within(dialog).findByText('做法')).toBeInTheDocument();
});
