import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'fs';
import { join } from 'path';
import Lalem from './Lalem';

const toilets = {
  toilets: [
    {
      id: 'roman-forica',
      title: '罗马公共厕所',
      titleEn: 'Roman forica',
      blurb: '大家坐成一排聊天。',
      blurbEn: 'A social bench of holes.',
      shape: 'squat',
      size: 'long',
      class: 'public',
      era: 'roman',
      region: 'Rome',
      imageUrl: '/lalem/toilets/roman-forica.svg',
      credit: '拉了么原创插画',
    },
    {
      id: 'japan-washlet',
      title: '日本智洁马桶',
      titleEn: 'Japanese washlet',
      blurb: '盖子自己抬。',
      blurbEn: 'The lid lifts for you.',
      shape: 'sit',
      size: 'standard',
      class: 'home',
      era: 'modern',
      region: 'Tokyo',
      imageUrl: '/lalem/toilets/japan-washlet.svg',
      credit: '拉了么原创插画',
    },
  ],
};

const digest = {
  locale: 'cn',
  disclaimer: '卫生间小贴士，不能替代医疗诊断或治疗。',
  trends: [
    {
      kind: 'fashion',
      title: '今日新色',
      hook: '今天的热搜。',
      imageUrl: '/lalem/trends/fashion-1.svg',
    },
    {
      kind: 'entertainment',
      title: '昨日综艺',
      hook: '昨天还在聊。',
      imageUrl: '/lalem/trends/entertainment-1.svg',
    },
  ],
  videos: [
    {
      title: '娱乐热片',
      posterUrl: '/lalem/videos/hot-ent.jpg',
      srcUrl: '/lalem/videos/hot-ent.mp4',
    },
  ],
  useful: ['今日贴士：别蹲太久', '昨日贴士：洗手到泡沫'],
};

function mockLalemFetch() {
  return jest.fn().mockImplementation((url: RequestInfo) => {
    const href = String(url);
    if (href.includes('/lalem/digest')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => digest,
      });
    }
    return Promise.resolve({
      ok: true,
      status: 200,
      json: async () => toilets,
    });
  }) as jest.Mock;
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  Object.defineProperty(window.navigator, 'language', { configurable: true, value: 'en-US' });
  global.fetch = mockLalemFetch();
});

afterEach(() => {
  jest.useRealTimers();
  Object.defineProperty(document, 'hidden', { configurable: true, value: false });
});

test('fresh visit shows 拉了么 and toilet images, not officer nav', async () => {
  render(<Lalem />);
  expect(screen.getByRole('heading', { name: '拉了么' })).toBeInTheDocument();
  expect(screen.getByText('来都来了')).toBeInTheDocument();
  expect(screen.getByText(/已坐/)).toBeInTheDocument();
  const img = await screen.findByRole('img', { name: '罗马公共厕所' });
  expect(img).toHaveAttribute('src', '/lalem/toilets/roman-forica.svg');
  expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  expect(document.querySelector('.synth-grid-bg')).toBeNull();
  expect(document.querySelector('.fr-page')).toBeNull();
  expect(document.documentElement).toHaveClass('ll-world');
  expect(document.querySelector('.ll-page')).not.toBeNull();
});

test('language toggle switches chrome to English', async () => {
  render(<Lalem />);
  await userEvent.click(screen.getByRole('button', { name: 'EN' }));
  expect(screen.getByRole('heading', { name: 'La le me' })).toBeInTheDocument();
  expect(screen.getByText(/You’re already here|already here/i)).toBeInTheDocument();
});

test('shape filter hides non-matching toilets', async () => {
  render(<Lalem />);
  await screen.findByRole('img', { name: '罗马公共厕所' });
  expect(screen.getByRole('img', { name: '日本智洁马桶' })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: '蹲便' }));
  expect(screen.getByRole('img', { name: '罗马公共厕所' })).toBeInTheDocument();
  expect(screen.queryByRole('img', { name: '日本智洁马桶' })).not.toBeInTheDocument();
});

test('tapping a toilet card opens a sheet', async () => {
  render(<Lalem />);
  await userEvent.click(await screen.findByRole('img', { name: '罗马公共厕所' }));
  const dialog = await screen.findByRole('dialog', { name: '罗马公共厕所' });
  expect(within(dialog).getByText(/坐成一排/)).toBeInTheDocument();
});

test('热榜 has a playable video and 有用 shows not-medical copy', async () => {
  render(<Lalem />);
  await userEvent.click(screen.getByRole('button', { name: '热榜' }));
  const video = await waitFor(() => {
    const el = document.querySelector('video');
    expect(el).not.toBeNull();
    return el as HTMLVideoElement;
  });
  expect(video).toHaveAttribute('src', '/lalem/videos/hot-ent.mp4');
  expect(video.muted).toBe(true);
  expect(screen.getByText('今日新色')).toBeInTheDocument();
  const trendTitles = screen.getAllByRole('heading', { level: 2 }).map((el) => el.textContent);
  expect(trendTitles.indexOf('今日新色')).toBeLessThan(trendTitles.indexOf('昨日综艺'));
  const trendImgs = screen.getAllByRole('img', { name: '' });
  expect(trendImgs.length).toBeGreaterThanOrEqual(2);
  expect(trendImgs[0]).toHaveAttribute('src', '/lalem/trends/fashion-1.svg');
  await userEvent.click(screen.getByRole('button', { name: '有用' }));
  expect(screen.getByText(/不能替代医疗|not medical/i)).toBeInTheDocument();
  const notes = screen.getAllByRole('listitem').map((el) => el.textContent);
  expect(notes.indexOf('今日贴士：别蹲太久')).toBeLessThan(notes.indexOf('昨日贴士：洗手到泡沫'));
  expect(screen.getByText('今日贴士：别蹲太久')).toBeInTheDocument();
  expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
});

test('sit alert pops at 5 minutes, dismiss waits, 10 minutes is more dramatic', () => {
  jest.useFakeTimers();
  const start = 1_700_000_000_000;
  jest.setSystemTime(start);
  render(<Lalem />);
  expect(screen.queryByRole('dialog', { name: '久坐警报' })).not.toBeInTheDocument();

  act(() => {
    jest.setSystemTime(start + 5 * 60 * 1000);
    jest.advanceTimersByTime(1000);
  });
  const five = screen.getByRole('dialog', { name: '久坐警报' });
  expect(five).toHaveClass('ll-sit-alert', 'll-sit-alert--t1');
  expect(five).toHaveTextContent('5');
  expect(screen.getAllByRole('dialog', { name: '久坐警报' })).toHaveLength(1);

  fireEvent.click(screen.getByRole('button', { name: '再蹲会儿' }));
  expect(screen.queryByRole('dialog', { name: '久坐警报' })).not.toBeInTheDocument();

  act(() => {
    jest.setSystemTime(start + 9 * 60 * 1000 + 58 * 1000);
    jest.advanceTimersByTime(1000);
  });
  expect(screen.queryByRole('dialog', { name: '久坐警报' })).not.toBeInTheDocument();

  act(() => {
    jest.setSystemTime(start + 10 * 60 * 1000);
    jest.advanceTimersByTime(1000);
  });
  const ten = screen.getByRole('dialog', { name: '久坐警报' });
  expect(ten).toHaveClass('ll-sit-alert--t2');
  expect(ten).not.toHaveClass('ll-sit-alert--t1');
  expect(ten).toHaveTextContent('10');
  expect(screen.getAllByRole('dialog', { name: '久坐警报' })).toHaveLength(1);
  jest.useRealTimers();
});

test('sit alert waits until the page is visible again', () => {
  jest.useFakeTimers();
  const start = 1_700_000_000_000;
  jest.setSystemTime(start);
  let hidden = true;
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
  render(<Lalem />);
  act(() => {
    jest.setSystemTime(start + 5 * 60 * 1000);
    jest.advanceTimersByTime(1000);
  });
  expect(screen.queryByRole('dialog', { name: '久坐警报' })).not.toBeInTheDocument();
  hidden = false;
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'));
    jest.advanceTimersByTime(1000);
  });
  expect(screen.getByRole('dialog', { name: '久坐警报' })).toHaveClass('ll-sit-alert--t1');
  jest.useRealTimers();
});

test('Lalem source does not use the Notification API', () => {
  const src = readFileSync(join(__dirname, 'Lalem.tsx'), 'utf8');
  expect(src).not.toMatch(/Notification/);
  expect(src).not.toMatch(/requestPermission/);
});
