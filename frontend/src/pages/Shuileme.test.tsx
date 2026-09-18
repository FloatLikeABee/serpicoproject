import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'fs';
import { join } from 'path';
import Shuileme from './Shuileme';
import { stopShuilemeSound } from '../utils/shuilemeSound';

const beds = {
  beds: [
    {
      id: 'fire-kang',
      title: '火炕',
      titleEn: 'Heated kang',
      blurb: '土坯暖床，脚先暖。',
      blurbEn: 'A clay heated platform. Warm the feet first.',
      size: 'kang-width',
      fill: 'kang',
      era: 'tang',
      region: 'Northeast China',
      imageUrl: '/shuileme/beds/fire-kang.jpg',
      wikiUrlZh: 'https://zh.wikipedia.org/wiki/%E7%82%BD',
      wikiUrlEn: 'https://en.wikipedia.org/wiki/Kang_bed-stove',
      credit: '睡了么插画',
    },
    {
      id: 'tatami',
      title: '榻榻米',
      titleEn: 'Tatami',
      blurb: '草席贴地，灯先暗。',
      blurbEn: 'Rush mats on the floor. Dim the lamp first.',
      size: 'single',
      fill: 'futon',
      era: 'edo',
      region: 'Kyoto',
      imageUrl: '/shuileme/beds/tatami.jpg',
      wikiUrlZh: 'https://zh.wikipedia.org/wiki/%E6%98%8F%E7%94%B0',
      wikiUrlEn: 'https://en.wikipedia.org/wiki/Tatami',
      credit: '睡了么插画',
    },
    {
      id: 'luohan-bed',
      title: '罗汉床',
      titleEn: 'Luohan couch-bed',
      blurb: '三面围栏。',
      blurbEn: 'Rails on three sides.',
      size: 'double',
      fill: 'platform',
      era: 'ancient',
      region: 'Jiangnan',
      imageUrl: '/shuileme/beds/luohan-bed.jpg',
      wikiUrlZh: 'https://zh.wikipedia.org/wiki/%E7%BD%97%E6%B1%89%E5%BA%8A',
      wikiUrlEn: 'https://en.wikipedia.org/wiki/Chinese_furniture',
      credit: '睡了么插画',
    },
  ],
};

const bedrooms = {
  bedrooms: [
    {
      id: 'blackout-cave',
      title: '黑房间',
      titleEn: 'Blackout cave',
      blurb: '窗帘把白天关在门外。',
      blurbEn: 'Curtains keep daylight outside.',
      light: 'blackout',
      layout: 'alcove',
      imageUrl: '/shuileme/rooms/blackout-cave.jpg',
      wikiUrlZh: 'https://zh.wikipedia.org/wiki/%E5%8D%A7%E5%AE%A4',
      wikiUrlEn: 'https://en.wikipedia.org/wiki/Bedroom',
      credit: '睡了么插画',
    },
    {
      id: 'yurt-night',
      title: '蒙古包夜',
      titleEn: 'Yurt night',
      blurb: '圆顶漏一点月亮。',
      blurbEn: 'A round roof lets a little moon in.',
      light: 'moon',
      layout: 'tent',
      imageUrl: '/shuileme/rooms/yurt-night.jpg',
      wikiUrlZh: 'https://zh.wikipedia.org/wiki/%E8%92%99%E5%8F%A4%E5%8C%85',
      wikiUrlEn: 'https://en.wikipedia.org/wiki/Yurt',
      credit: '睡了么插画',
    },
    {
      id: 'bamboo-nap',
      title: '竹帘午睡',
      titleEn: 'Bamboo nap',
      blurb: '竹影在墙上走。',
      blurbEn: 'Bamboo shade on the wall.',
      light: 'day-shutters',
      layout: 'alcove',
      imageUrl: '/shuileme/rooms/bamboo-nap.jpg',
      wikiUrlZh: 'https://zh.wikipedia.org/wiki/%E7%AB%B9',
      wikiUrlEn: 'https://en.wikipedia.org/wiki/Bamboo',
      credit: '睡了么插画',
    },
  ],
};

const lore = {
  articles: [
    {
      id: 'circadian-clock',
      title: '生物钟',
      titleEn: 'Circadian clock',
      body: '身体里有大约一天的节奏。亮和暗会拨它。这是百科描述，不是诊断。',
      bodyEn: 'The body keeps a roughly daily rhythm. Light and dark nudge it. Encyclopedia copy, not a diagnosis.',
      imageUrl: '/shuileme/lore/circadian-clock.jpg',
      credit: '睡了么媒体包',
      sources: [
        { label: 'Wikipedia', url: 'https://zh.wikipedia.org/wiki/%E7%94%9F%E7%89%A9%E9%90%98' },
        { label: 'NHS', url: 'https://www.nhs.uk/live-well/sleep-and-tiredness/' },
      ],
    },
  ],
};

function mockShuilemeFetch() {
  return jest.fn().mockImplementation((url: RequestInfo) => {
    const href = String(url);
    if (href.includes('/lalem/')) {
      return Promise.reject(new Error('睡了么 must not call /lalem/'));
    }
    if (href.includes('/shuileme/chat')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          reply: '加法满足交换律。一加二等于二加一。句子很短。这不是诊断。',
        }),
      });
    }
    if (href.includes('/shuileme/wiki')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          title: '炕',
          extract: '中国北方的暖床。',
          lang: 'zh',
          sourceUrl: 'https://zh.wikipedia.org/wiki/%E7%82%BD',
        }),
      });
    }
    if (href.includes('/shuileme/lore')) {
      return Promise.resolve({ ok: true, status: 200, json: async () => lore });
    }
    if (href.includes('/shuileme/bedrooms')) {
      return Promise.resolve({ ok: true, status: 200, json: async () => bedrooms });
    }
    return Promise.resolve({ ok: true, status: 200, json: async () => beds });
  }) as jest.Mock;
}

function cardTitleButton(name: string): HTMLElement {
  const img = screen.getByRole('img', { name });
  const btn = img.closest('article')?.querySelector('.sm-card-open');
  if (!btn) throw new Error(`missing title control for ${name}`);
  return btn as HTMLElement;
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  window.history.pushState({}, '', '/shuileme');
  global.fetch = mockShuilemeFetch();
});

afterEach(() => {
  jest.useRealTimers();
  stopShuilemeSound();
});

test('fresh visit shows 睡了么, not officer nav or 拉了么 world', async () => {
  render(<Shuileme />);
  expect(screen.getByRole('heading', { name: '睡了么' })).toBeInTheDocument();
  expect(screen.getByText('睡吧')).toBeInTheDocument();
  expect(screen.getByText(/已躺/)).toBeInTheDocument();
  const hero = await screen.findByRole('img', { name: '火炕' });
  await waitFor(() => expect(hero).toHaveAttribute('src', '/shuileme/beds/fire-kang.jpg'));
  expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  expect(document.querySelectorAll('.sm-dock button')).toHaveLength(6);
  expect(screen.getByRole('button', { name: '床' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '卧' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '典' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '声' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '息' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '聊' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '醒了' })).toBeInTheDocument();
  expect(document.querySelector('.fr-page')).toBeNull();
  expect(document.documentElement).toHaveClass('sm-world');
  expect(document.documentElement).not.toHaveClass('ll-world');
  expect(document.querySelector('video')).toBeNull();
});

test('bed title opens a photo-rich sheet without wikipedia links', async () => {
  render(<Shuileme />);
  await screen.findByRole('img', { name: '火炕' });
  await userEvent.click(cardTitleButton('火炕'));
  const sheet = await screen.findByRole('dialog', { name: '火炕' });
  expect(sheet.querySelector('img.sm-sheet-hero')).toHaveAttribute('src', '/shuileme/beds/fire-kang.jpg');
  expect(sheet.querySelectorAll('.sm-sheet-chip').length).toBeGreaterThan(0);
  expect(within(sheet).queryByRole('link', { name: /维基|Wiki|Wikipedia/i })).toBeNull();
  expect(document.querySelectorAll('a[href*="wikipedia.org"]')).toHaveLength(0);
  expect(document.querySelector('video')).toBeNull();
});

test('bedroom light filter hides non-matching rooms', async () => {
  render(<Shuileme />);
  await userEvent.click(screen.getByRole('button', { name: '卧' }));
  await screen.findByRole('img', { name: '黑房间' });
  expect(screen.getByRole('img', { name: '蒙古包夜' })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: '全黑' }));
  expect(screen.getByRole('img', { name: '黑房间' })).toBeInTheDocument();
  expect(screen.queryByRole('img', { name: '蒙古包夜' })).not.toBeInTheDocument();
});

test('lore sheet is encyclopedia, not a diagnosis', async () => {
  render(<Shuileme />);
  await userEvent.click(screen.getByRole('button', { name: '典' }));
  const loreImg = await screen.findByRole('img', { name: '生物钟' });
  expect(loreImg.closest('a')).toBeNull();
  await userEvent.click(cardTitleButton('生物钟'));
  const sheet = await screen.findByRole('dialog', { name: '生物钟' });
  expect(sheet).toHaveTextContent(/不能替代医疗|not medical/i);
  expect(sheet.textContent || '').not.toMatch(/you have|你患有/i);
  expect(within(sheet).queryByRole('link', { name: /Wikipedia/i })).toBeNull();
  expect(within(sheet).getByRole('link', { name: 'NHS' })).toHaveAttribute(
    'href',
    'https://www.nhs.uk/live-well/sleep-and-tiredness/'
  );
});

test('no sit-alert after five minutes', () => {
  jest.useFakeTimers();
  const start = 1_700_000_000_000;
  jest.setSystemTime(start);
  render(<Shuileme />);
  act(() => {
    jest.setSystemTime(start + 5 * 60 * 1000);
    jest.advanceTimersByTime(1000);
  });
  expect(screen.queryByRole('dialog', { name: '久坐警报' })).not.toBeInTheDocument();
  expect(screen.queryByRole('dialog', { name: /sit alert/i })).not.toBeInTheDocument();
  jest.useRealTimers();
});

test('sound dock tap resumes audio; first paint is silent', async () => {
  const resume = jest.fn().mockResolvedValue(undefined);
  const close = jest.fn();
  const FakeCtx = jest.fn().mockImplementation(() => ({
    resume,
    close,
    state: 'suspended',
    sampleRate: 44100,
    destination: {},
    createBuffer: () => ({
      length: 1024,
      numberOfChannels: 1,
      sampleRate: 44100,
      getChannelData: () => new Float32Array(1024),
    }),
    createBufferSource: () => ({
      connect: jest.fn(),
      start: jest.fn(),
      stop: jest.fn(),
      loop: true,
      buffer: null,
    }),
    createGain: () => ({ connect: jest.fn(), gain: { value: 1 } }),
    createBiquadFilter: () => ({
      connect: jest.fn(),
      type: 'lowpass',
      frequency: { value: 800 },
    }),
  }));
  (window as unknown as { AudioContext: unknown }).AudioContext = FakeCtx;
  const { unmount } = render(<Shuileme />);
  await userEvent.click(screen.getByRole('button', { name: '声' }));
  expect(resume).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: /褐噪|Brown/ }));
  expect(resume).toHaveBeenCalled();
  expect(document.querySelector('video')).toBeNull();
  unmount();
  expect(close).toHaveBeenCalled();
});

test('wind-down is a static field when reduced motion is on', async () => {
  const prev = window.matchMedia;
  window.matchMedia = jest.fn().mockImplementation((query: string) => ({
    matches: String(query).includes('prefers-reduced-motion'),
    media: query,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  }));
  render(<Shuileme />);
  await userEvent.click(screen.getByRole('button', { name: '息' }));
  const breathe = document.querySelector('.sm-breathe');
  expect(breathe).not.toBeNull();
  expect(breathe).toHaveClass('sm-breathe--static');
  expect(document.querySelector('video')).toBeNull();
  window.matchMedia = prev;
});

test('Shuileme source does not use Notification or video', () => {
  const src = readFileSync(join(__dirname, 'Shuileme.tsx'), 'utf8');
  expect(src).not.toMatch(/Notification/);
  expect(src).not.toMatch(/requestPermission/);
  expect(src).not.toMatch(/<video/);
  expect(src).not.toMatch(/youtube|douyin|tiktok/i);
  expect(src).not.toMatch(/\/lalem\//);
  expect(src).not.toMatch(/#c6a56a/);
});

test('bed cards appear before every photo src is assigned', async () => {
  render(<Shuileme />);
  expect(await screen.findByText('火炕')).toBeInTheDocument();
  expect(screen.getByText('榻榻米')).toBeInTheDocument();
  expect(screen.getByText('罗汉床')).toBeInTheDocument();
  expect(document.querySelectorAll('.sm-ph').length).toBeGreaterThanOrEqual(3);
  const imgs = Array.from(document.querySelectorAll('.sm-gallery img')) as HTMLImageElement[];
  expect(imgs.length).toBeGreaterThanOrEqual(3);
  const withSrc = imgs.filter((img) => img.getAttribute('src'));
  expect(withSrc.length).toBe(2);
  fireEvent.load(withSrc[0]);
  const later = imgs.find((img) => !withSrc.includes(img));
  expect(later?.getAttribute('src')).toBe('/shuileme/beds/luohan-bed.jpg');
});

test('bedroom photos wait their turn', async () => {
  render(<Shuileme />);
  await userEvent.click(screen.getByRole('button', { name: '卧' }));
  expect(await screen.findByText('黑房间')).toBeInTheDocument();
  expect(screen.getByText('蒙古包夜')).toBeInTheDocument();
  expect(screen.getByText('竹帘午睡')).toBeInTheDocument();
  const imgs = Array.from(document.querySelectorAll('.sm-gallery img')) as HTMLImageElement[];
  expect(imgs.filter((img) => img.getAttribute('src')).length).toBe(2);
});

test('醒了 freezes 已躺 and stops sound', async () => {
  jest.useFakeTimers();
  const start = 1_700_000_000_000;
  jest.setSystemTime(start);
  const resume = jest.fn().mockResolvedValue(undefined);
  const close = jest.fn();
  (window as unknown as { AudioContext: unknown }).AudioContext = jest.fn().mockImplementation(() => ({
    resume,
    close,
    state: 'suspended',
    sampleRate: 44100,
    destination: {},
    createBuffer: () => ({
      length: 1024,
      numberOfChannels: 1,
      sampleRate: 44100,
      getChannelData: () => new Float32Array(1024),
    }),
    createBufferSource: () => ({
      connect: jest.fn(),
      start: jest.fn(),
      stop: jest.fn(),
      loop: true,
      buffer: null,
    }),
    createGain: () => ({ connect: jest.fn(), gain: { value: 1 } }),
    createBiquadFilter: () => ({
      connect: jest.fn(),
      type: 'lowpass',
      frequency: { value: 800 },
    }),
  }));
  render(<Shuileme />);
  fireEvent.click(screen.getByRole('button', { name: '声' }));
  fireEvent.click(screen.getByRole('button', { name: /褐噪|Brown/ }));
  await act(async () => {
    await Promise.resolve();
  });
  fireEvent.click(screen.getByRole('button', { name: '醒了' }));
  const frozen = screen.getByText(/已躺/).textContent;
  act(() => {
    jest.setSystemTime(start + 12 * 1000);
    jest.advanceTimersByTime(2000);
  });
  expect(screen.getByText(/已躺/).textContent).toBe(frozen);
  expect(close).toHaveBeenCalled();
  expect(screen.getByRole('heading', { name: '睡了么' })).toBeInTheDocument();
  expect(document.querySelector('.fr-page')).toBeNull();
  expect(document.documentElement).toHaveClass('sm-world');
  const lalemCalls = (global.fetch as jest.Mock).mock.calls.filter((call) => String(call[0]).includes('/lalem/'));
  expect(lalemCalls).toHaveLength(0);
  jest.useRealTimers();
});

test('sound dock marks playing and 停 silences', async () => {
  const resume = jest.fn().mockResolvedValue(undefined);
  const close = jest.fn();
  (window as unknown as { AudioContext: unknown }).AudioContext = jest.fn().mockImplementation(() => ({
    resume,
    close,
    state: 'suspended',
    sampleRate: 44100,
    destination: {},
    createBuffer: () => ({
      length: 1024,
      numberOfChannels: 1,
      sampleRate: 44100,
      getChannelData: () => new Float32Array(1024),
    }),
    createBufferSource: () => ({
      connect: jest.fn(),
      start: jest.fn(),
      stop: jest.fn(),
      loop: true,
      buffer: null,
    }),
    createGain: () => ({ connect: jest.fn(), gain: { value: 1 } }),
    createBiquadFilter: () => ({
      connect: jest.fn(),
      type: 'lowpass',
      frequency: { value: 800 },
    }),
  }));
  render(<Shuileme />);
  await userEvent.click(screen.getByRole('button', { name: '声' }));
  expect(resume).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: /褐噪|Brown/ }));
  expect(resume).toHaveBeenCalled();
  expect(screen.getByText(/正在响|Playing/)).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: '停' }));
  expect(close).toHaveBeenCalled();
  expect(screen.queryByText(/正在响|Playing/)).not.toBeInTheDocument();
  expect(screen.getByRole('heading', { name: '睡了么' })).toBeInTheDocument();
});

test('/shuileme/chat opens the 聊 dock inside 睡了么', async () => {
  window.history.pushState({}, '', '/shuileme/chat');
  render(<Shuileme />);
  expect(screen.getByRole('heading', { name: '睡了么' })).toBeInTheDocument();
  expect(screen.getByRole('textbox').tagName).toBe('TEXTAREA');
  expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  expect(window.location.pathname).toBe('/shuileme/chat');
});

test('聊 dock stays on the 睡了么 app at /shuileme/chat', async () => {
  render(<Shuileme />);
  await userEvent.click(screen.getByRole('button', { name: '聊' }));
  expect(window.location.pathname).toBe('/shuileme/chat');
  expect(screen.getByRole('textbox').tagName).toBe('TEXTAREA');
  expect(screen.getByRole('heading', { name: '睡了么' })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: '床' }));
  expect(window.location.pathname).toBe('/shuileme');
});

test('chat dock shows a dry lecture and a sleepy thinking status', async () => {
  let releaseChat: ((value: unknown) => void) | undefined;
  const inner = mockShuilemeFetch();
  global.fetch = jest.fn().mockImplementation((url: RequestInfo, init?: RequestInit) => {
    const href = String(url);
    if (href.includes('/shuileme/chat')) {
      return new Promise((resolve) => {
        releaseChat = resolve;
      });
    }
    return inner(url, init);
  });
  render(<Shuileme />);
  await userEvent.click(screen.getByRole('button', { name: '聊' }));
  const box = screen.getByRole('textbox');
  expect(box.tagName).toBe('TEXTAREA');
  await userEvent.type(box, '讲一点数学');
  await userEvent.click(screen.getByRole('button', { name: '发送' }));
  const status = await screen.findByRole('status');
  expect(status).toBeInTheDocument();
  expect(document.querySelector('.sm-chat-log')).toHaveAttribute('aria-busy', 'true');
  expect(window.getComputedStyle(status).color).not.toMatch(/#7ee0ff|#c9f07a|#c6a56a/i);
  await act(async () => {
    releaseChat?.({
      ok: true,
      status: 200,
      json: async () => ({ reply: '加法满足交换律。一加二等于二加一。句子很短。这不是诊断。' }),
    });
  });
  expect(await screen.findByText(/交换律/)).toBeInTheDocument();
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  expect((screen.getByText(/交换律/).textContent || '')).not.toMatch(/you have|你患有/i);
  const chatCalls = (global.fetch as jest.Mock).mock.calls.filter((call) => String(call[0]).includes('/shuileme/chat'));
  expect(chatCalls.length).toBeGreaterThan(0);
  expect(String(chatCalls[0][1]?.method || '')).toMatch(/POST/i);
  const lalemCalls = (global.fetch as jest.Mock).mock.calls.filter((call) => String(call[0]).includes('/lalem/'));
  expect(lalemCalls).toHaveLength(0);
  expect(document.querySelector('video')).toBeNull();
});

test('off-topic sleep chat returns to a dull lecture', async () => {
  global.fetch = jest.fn().mockImplementation((url: RequestInfo, init?: RequestInit) => {
    const href = String(url);
    if (href.includes('/shuileme/chat')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ reply: '夜空看起来暗，因为没有阳光散射。这是简单的光学。不是案件，也不是便便。' }),
      });
    }
    return mockShuilemeFetch()(url, init);
  });
  render(<Shuileme />);
  await userEvent.click(screen.getByRole('button', { name: '聊' }));
  await userEvent.type(screen.getByRole('textbox'), 'officer case file and Fridge Raid leftovers and poop');
  await userEvent.click(screen.getByRole('button', { name: '发送' }));
  const reply = await screen.findByText(/光学|散射/);
  expect(reply.textContent || '').not.toMatch(/Officer Serpico|case file|便便科普/i);
});

test('reduced-motion thinking stays static', async () => {
  const prev = window.matchMedia;
  window.matchMedia = jest.fn().mockImplementation((query: string) => ({
    matches: String(query).includes('prefers-reduced-motion'),
    media: query,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  }));
  global.fetch = jest.fn().mockImplementation((url: RequestInfo, init?: RequestInit) => {
    const href = String(url);
    if (href.includes('/shuileme/chat')) {
      return new Promise(() => {
        /* hang so thinking stays */
      });
    }
    return mockShuilemeFetch()(url, init);
  });
  render(<Shuileme />);
  await userEvent.click(screen.getByRole('button', { name: '聊' }));
  await userEvent.type(screen.getByRole('textbox'), '讲一点法律');
  await userEvent.click(screen.getByRole('button', { name: '发送' }));
  const status = await screen.findByRole('status');
  expect(status).toHaveClass('sm-think--static');
  window.matchMedia = prev;
});
