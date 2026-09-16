import '@testing-library/jest-dom';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
      kind: 'entertainment',
      title: '综艺夜',
      hook: '今晚热聊。',
      imageUrl: '/lalem/trends/entertainment-1.svg',
    },
    {
      kind: 'fashion',
      title: '新色号',
      hook: '妆容换季。',
      imageUrl: '/lalem/trends/fashion-1.svg',
    },
  ],
  videos: [
    {
      title: '娱乐热片',
      posterUrl: '/lalem/videos/hot-ent.jpg',
      srcUrl: '/lalem/videos/hot-ent.mp4',
    },
  ],
  useful: ['别蹲太久', '洗手到泡沫'],
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
  expect(screen.getByText('综艺夜')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: '有用' }));
  expect(screen.getByText(/不能替代医疗|not medical/i)).toBeInTheDocument();
  expect(screen.getByText('别蹲太久')).toBeInTheDocument();
  expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
});
