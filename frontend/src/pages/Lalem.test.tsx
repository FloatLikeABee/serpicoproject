import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
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
      imageUrl: '/lalem/toilets/roman-forica.jpg',
      wikiUrlZh: 'https://zh.wikipedia.org/wiki/%E5%85%AC%E5%85%B1%E5%8E%95%E6%89%80',
      wikiUrlEn: 'https://en.wikipedia.org/wiki/Latrine',
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
      imageUrl: '/lalem/toilets/japan-washlet.jpg',
      wikiUrlZh: 'https://zh.wikipedia.org/wiki/%E6%B8%85%E6%B4%97%E9%A9%AC%E6%A1%B6%E7%9B%96',
      wikiUrlEn: 'https://en.wikipedia.org/wiki/Washlet',
      credit: '拉了么原创插画',
    },
  ],
};

const papers = {
  papers: [
    {
      id: 'xylospongium',
      title: '海绵棒',
      titleEn: 'Xylospongium',
      blurb: '古罗马公共厕所里传来传去的海绵棒。',
      blurbEn: 'A communal sponge-stick.',
      era: 'roman',
      imageUrl: '/lalem/papers/xylospongium.jpg',
      wikiUrlZh: 'https://zh.wikipedia.org/wiki/%E6%B5%B7%E7%BB%B5',
      wikiUrlEn: 'https://en.wikipedia.org/wiki/Xylospongium',
      credit: '拉了么原创插画',
    },
  ],
};

const medicine = {
  articles: [
    {
      id: 'posture-squat-sit',
      title: '蹲还是坐：排便姿势',
      titleEn: 'Squat or sit: defecation posture',
      body: '坐便器把髋关节放得比较直。蹲坑让膝盖高于髋。这是解剖描述。',
      bodyEn: 'A sit toilet keeps the hips more open. A squat pan puts the knees above the hips.',
      sources: [
        { label: 'Wikipedia', url: 'https://zh.wikipedia.org/wiki/%E6%8E%92%E4%BE%BF' },
        { label: 'NHS', url: 'https://www.nhs.uk/conditions/constipation/' },
      ],
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
      imageUrl: '/lalem/trends/fashion-1.jpg',
    },
    {
      kind: 'entertainment',
      title: '昨日综艺',
      hook: '昨天还在聊蹲姿。',
      imageUrl: '/lalem/trends/entertainment-1.jpg',
      topicId: 'medicine:posture-squat-sit',
    },
  ],
  videos: [],
  useful: ['今日贴士：别蹲太久', '昨日贴士：洗手到泡沫'],
};

function mockLalemFetch() {
  return jest.fn().mockImplementation((url: RequestInfo) => {
    const href = String(url);
    if (href.includes('/lalem/wiki')) {
      const wikiUrl = decodeURIComponent((href.split('url=')[1] || '').split('&')[0]);
      const zh = wikiUrl.includes('zh.wikipedia.org');
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () =>
          zh
            ? {
                title: '公共厕所',
                extract: '古罗马公共厕所。',
                lang: 'zh',
                sourceUrl: wikiUrl,
              }
            : {
                title: 'Latrine',
                extract: 'A communal latrine.',
                lang: 'en',
                sourceUrl: wikiUrl,
              },
      });
    }
    if (href.includes('/lalem/digest')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => digest,
      });
    }
    if (href.includes('/lalem/papers')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => papers,
      });
    }
    if (href.includes('/lalem/medicine')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => medicine,
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

function cardTitleButton(name: string): HTMLElement {
  const img = screen.getByRole('img', { name });
  const btn = img.closest('article')?.querySelector('.ll-card-open');
  if (!btn) throw new Error(`missing title control for ${name}`);
  return btn as HTMLElement;
}

test('fresh visit shows 拉了么 and toilet images, not officer nav', async () => {
  render(<Lalem />);
  expect(screen.getByRole('heading', { name: '拉了么' })).toBeInTheDocument();
  expect(screen.getByText('来都来了')).toBeInTheDocument();
  expect(screen.getByText(/已坐/)).toBeInTheDocument();
  const img = await screen.findByRole('img', { name: '罗马公共厕所' });
  expect(img).toHaveAttribute('src', '/lalem/toilets/roman-forica.jpg');
  expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  expect(document.querySelectorAll('.ll-dock button')).toHaveLength(5);
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
  expect(screen.getByRole('button', { name: 'La bang' })).toBeInTheDocument();
});

test('toilet image opens in-app wiki reader; title still opens the sheet', async () => {
  render(<Lalem />);
  const img = await screen.findByRole('img', { name: '罗马公共厕所' });
  expect(img.closest('a')).toBeNull();
  expect(document.querySelectorAll('a[href*="wikipedia.org"]')).toHaveLength(0);
  const wikiBtn = img.closest('button');
  expect(wikiBtn).toHaveClass('ll-card-wiki');
  expect(wikiBtn).toHaveAttribute('type', 'button');
  await userEvent.click(wikiBtn as HTMLElement);
  const wiki = await screen.findByRole('dialog', { name: '公共厕所' });
  expect(wiki).toHaveClass('ll-wiki');
  expect(wiki).toHaveTextContent('古罗马公共厕所。');
  expect(within(wiki).queryByRole('link')).toBeNull();
  expect(wiki).toHaveTextContent('zh.wikipedia.org');
  expect(String((global.fetch as jest.Mock).mock.calls.map(String).join('\n'))).toMatch(/\/lalem\/wiki\?url=/);
  fireEvent.click(within(wiki).getByRole('button', { name: '关闭' }));
  await userEvent.click(cardTitleButton('罗马公共厕所'));
  const sheet = await screen.findByRole('dialog', { name: '罗马公共厕所' });
  expect(within(sheet).queryByRole('link', { name: /维基|Wiki|Wikipedia|百科/i })).toBeNull();
  await userEvent.click(within(sheet).getByRole('button', { name: /维基|Wiki|Wikipedia|百科/i }));
  const wikiFromSheet = await screen.findByRole('dialog', { name: '公共厕所' });
  expect(wikiFromSheet).toHaveTextContent('古罗马公共厕所。');
  fireEvent.click(within(wikiFromSheet).getByRole('button', { name: '关闭' }));
  fireEvent.click(within(sheet).getByRole('button', { name: '关闭' }));
  await userEvent.click(screen.getByRole('button', { name: 'EN' }));
  const enImg = await screen.findByRole('img', { name: 'Roman forica' });
  expect(enImg.closest('a')).toBeNull();
  await userEvent.click(enImg.closest('button') as HTMLElement);
  const enWiki = await screen.findByRole('dialog', { name: 'Latrine' });
  expect(enWiki).toHaveTextContent('A communal latrine.');
});

test('toilet filters use a label column and wrapping chips', async () => {
  render(<Lalem />);
  await screen.findByRole('img', { name: '罗马公共厕所' });
  const rows = document.querySelectorAll('.ll-filter-row');
  expect(rows.length).toBeGreaterThanOrEqual(4);
  rows.forEach((row) => {
    const label = row.querySelector('.ll-chip-label');
    const wrap = row.querySelector('.ll-chip-wrap');
    expect(label).not.toBeNull();
    expect(wrap).not.toBeNull();
    expect(wrap?.querySelectorAll('button').length).toBeGreaterThan(1);
    expect(label?.nextElementSibling).toBe(wrap);
    expect(row.querySelector(':scope > button')).toBeNull();
  });
  expect(document.querySelectorAll('.ll-dock button')).toHaveLength(5);
  const title = document.querySelector('.ll-card-title');
  expect(title).toHaveAttribute('title');
  expect(document.querySelector('video')).toBeNull();
});

test('shape filter hides non-matching toilets', async () => {
  render(<Lalem />);
  await screen.findByRole('img', { name: '罗马公共厕所' });
  expect(screen.getByRole('img', { name: '日本智洁马桶' })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: '蹲便' }));
  expect(screen.getByRole('img', { name: '罗马公共厕所' })).toBeInTheDocument();
  expect(screen.queryByRole('img', { name: '日本智洁马桶' })).not.toBeInTheDocument();
});

test('tapping a toilet title opens a sheet', async () => {
  render(<Lalem />);
  await screen.findByRole('img', { name: '罗马公共厕所' });
  await userEvent.click(cardTitleButton('罗马公共厕所'));
  const dialog = await screen.findByRole('dialog', { name: '罗马公共厕所' });
  expect(within(dialog).getByText(/坐成一排/)).toBeInTheDocument();
});

test('厕纸 dock persists across remount', async () => {
  const first = render(<Lalem />);
  await userEvent.click(screen.getByRole('button', { name: '厕纸' }));
  await screen.findByRole('img', { name: '海绵棒' });
  first.unmount();
  render(<Lalem />);
  expect(await screen.findByRole('img', { name: '海绵棒' })).toBeInTheDocument();
});

test('厕纸 and 医典 docks open galleries with sourced detail', async () => {
  render(<Lalem />);
  await userEvent.click(screen.getByRole('button', { name: '厕纸' }));
  const paperImg = await screen.findByRole('img', { name: '海绵棒' });
  expect(paperImg.closest('a')).toBeNull();
  expect(paperImg.closest('button')).toHaveClass('ll-card-wiki');
  await userEvent.click(cardTitleButton('海绵棒'));
  expect(await screen.findByRole('dialog', { name: '海绵棒' })).toHaveTextContent(/海绵棒/);
  fireEvent.click(screen.getByRole('button', { name: '关闭' }));
  await userEvent.click(screen.getByRole('button', { name: '医典' }));
  await userEvent.click(await screen.findByRole('button', { name: /蹲还是坐/ }));
  const lore = await screen.findByRole('dialog', { name: /蹲还是坐/ });
  expect(lore).toHaveTextContent(/不能替代医疗|not medical/i);
  expect(within(lore).queryByRole('link', { name: /Wikipedia/i })).toBeNull();
  expect(within(lore).getByRole('link', { name: 'NHS' })).toHaveAttribute(
    'href',
    'https://www.nhs.uk/conditions/constipation/'
  );
  await userEvent.click(within(lore).getByRole('button', { name: /Wikipedia/i }));
  const wiki = await screen.findByRole('dialog', { name: '公共厕所' });
  expect(within(wiki).queryByRole('link')).toBeNull();
  expect(document.querySelectorAll('a[href*="wikipedia.org"]')).toHaveLength(0);
});

test('拉榜 has no video; trends open encyclopedia or lounge copy', async () => {
  render(<Lalem />);
  await userEvent.click(screen.getByRole('button', { name: '拉榜' }));
  await screen.findByText('今日新色');
  expect(document.querySelector('video')).toBeNull();
  const thumbs = document.querySelectorAll('.ll-trend img');
  expect(thumbs.length).toBeGreaterThan(0);
  expect(thumbs[0]).toHaveAttribute('src', '/lalem/trends/fashion-1.jpg');
  const tags = Array.from(document.querySelectorAll('.ll-trend-tag')).map(
    (el) => el.textContent || ''
  );
  expect(tags.some((t) => /时尚|Fashion/.test(t))).toBe(true);
  expect(tags.some((t) => /娱乐|Entertainment/.test(t))).toBe(true);
  expect(screen.getByText('今日新色')).toBeInTheDocument();
  const trendTitles = screen.getAllByRole('heading', { level: 2 }).map((el) => el.textContent);
  expect(trendTitles.indexOf('今日新色')).toBeLessThan(trendTitles.indexOf('昨日综艺'));
  await userEvent.click(screen.getByRole('button', { name: /昨日综艺/ }));
  const mapped = await screen.findByRole('dialog', { name: /蹲还是坐|昨日综艺/ });
  expect(mapped).toHaveTextContent(/解剖|姿势|髋/);
  fireEvent.click(screen.getByRole('button', { name: '关闭' }));
  await userEvent.click(screen.getByRole('button', { name: /今日新色/ }));
  const lounge = await screen.findByRole('dialog', { name: '今日新色' });
  expect(lounge.querySelector('img')).toBeNull();
  expect(lounge).toHaveTextContent(/玩笑|lounge|不是新闻/i);
  fireEvent.click(screen.getByRole('button', { name: '关闭' }));
  await userEvent.click(screen.getByRole('button', { name: '有用' }));
  expect(screen.getByText(/不能替代医疗|not medical/i)).toBeInTheDocument();
  const notes = screen.getAllByRole('listitem').map((el) => el.textContent);
  expect(notes.indexOf('今日贴士：别蹲太久')).toBeLessThan(notes.indexOf('昨日贴士：洗手到泡沫'));
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
  expect(src).not.toMatch(/<video/);
  expect(src).not.toMatch(/youtube|douyin|tiktok/i);
});
