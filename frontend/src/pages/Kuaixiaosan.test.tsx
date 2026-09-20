import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'fs';
import { join } from 'path';
import Kuaixiaosan from './Kuaixiaosan';

const stones = {
  stones: [
    {
      id: 'calcium-oxalate-kidney',
      title: '草酸钙结石',
      titleEn: 'Calcium oxalate stone',
      blurb: '最常见的成分，多与草酸负荷有关。这是标本百科，不是诊断。',
      blurbEn: 'The most common composition, often linked to oxalate load. Specimen encyclopedia, not a diagnosis.',
      composition: 'calcium-oxalate',
      site: 'kidney',
      sizeClass: 'small',
      imageUrl: '/kuaixiaosan/stones/calcium-oxalate-kidney.jpg',
      wikiUrlZh: 'https://zh.wikipedia.org/wiki/%E8%82%BE%E7%BB%93%E7%9F%B3',
      wikiUrlEn: 'https://en.wikipedia.org/wiki/Kidney_stone_disease',
      credit: '肾结石快消散媒体包',
    },
    {
      id: 'uric-ureter',
      title: '尿酸结石',
      titleEn: 'Uric acid stone',
      blurb: '在酸性尿里更容易析出。这是标本百科，不是诊断。',
      blurbEn: 'More likely to form in acidic urine. Specimen encyclopedia, not a diagnosis.',
      composition: 'uric',
      site: 'ureter',
      sizeClass: 'grit',
      imageUrl: '/kuaixiaosan/stones/uric-ureter.jpg',
      wikiUrlZh: 'https://zh.wikipedia.org/wiki/%E5%B0%BF%E9%85%B8',
      wikiUrlEn: 'https://en.wikipedia.org/wiki/Uric_acid',
      credit: '肾结石快消散媒体包',
    },
    {
      id: 'struvite-staghorn',
      title: '磷酸铵镁鹿角石',
      titleEn: 'Struvite staghorn',
      blurb: '与感染相关的大块铸型。这是标本百科，不是诊断。',
      blurbEn: 'Infection-related cast that can fill a pelvis. Specimen encyclopedia, not a diagnosis.',
      composition: 'struvite',
      site: 'kidney',
      sizeClass: 'staghorn',
      imageUrl: '/kuaixiaosan/stones/struvite-staghorn.jpg',
      wikiUrlZh: 'https://zh.wikipedia.org/wiki/%E9%B8%9F%E7%B2%9E%E7%9F%B3',
      wikiUrlEn: 'https://en.wikipedia.org/wiki/Struvite',
      credit: '肾结石快消散媒体包',
    },
  ],
};

const cases = {
  cases: [
    {
      id: 'colic-night',
      title: '夜里腰侧绞痛',
      titleEn: 'Night flank colic',
      body: '有人夜里忽然腰侧剧痛，坐立不安，尿色变深。这是典型过程的百科描述，不是诊断。',
      bodyEn: 'Someone wakes with sudden flank pain, cannot sit still, and urine looks darker. A typical course, not a personal diagnosis.',
      stage: 'colic',
      imageUrl: '/kuaixiaosan/cases/colic-night.jpg',
      credit: '肾结石快消散媒体包',
      sources: [
        { label: 'Wikipedia', url: 'https://zh.wikipedia.org/wiki/%E8%82%BE%E7%BB%93%E7%9F%B3' },
        { label: 'NHS', url: 'https://www.nhs.uk/conditions/kidney-stones/' },
      ],
    },
  ],
};

const recover = {
  recover: [
    {
      id: 'sip-and-strain',
      title: '小口喝水并滤过尿',
      titleEn: 'Sip fluids and strain urine',
      body: '急性期可小口补水、侧卧休息，并用滤网滤过尿液。发热加腰痛或完全无尿时要立刻就医。这不是处方剂量。',
      bodyEn: 'In the acute phase, sip fluids, rest on the side, and strain urine. Fever with flank pain or no urine at all means seek emergency care now. This is not a prescription dose.',
      phase: 'acute',
      imageUrl: '/kuaixiaosan/recover/sip-and-strain.jpg',
      credit: '肾结石快消散媒体包',
      sources: [
        { label: 'Wikipedia', url: 'https://zh.wikipedia.org/wiki/%E8%82%BE%E7%BB%93%E7%9F%B3' },
        { label: 'NHS', url: 'https://www.nhs.uk/conditions/kidney-stones/' },
      ],
    },
  ],
};

const lore = {
  articles: [
    {
      id: 'stone-formation',
      title: '结石怎样形成',
      titleEn: 'How stones form',
      body: '尿里的盐类过饱和时可能析出晶体。这是百科描述，不是诊断。',
      bodyEn: 'Salts in urine can crystallize when the solution is supersaturated. Encyclopedia copy, not a diagnosis.',
      topic: 'formation',
      imageUrl: '/kuaixiaosan/lore/stone-formation.jpg',
      credit: '肾结石快消散媒体包',
      sources: [
        { label: 'Wikipedia', url: 'https://zh.wikipedia.org/wiki/%E8%82%BE%E7%BB%93%E7%9F%B3' },
        { label: 'NHS', url: 'https://www.nhs.uk/conditions/kidney-stones/' },
      ],
    },
  ],
};

const imaging = {
  imaging: [
    {
      id: 'noncontrast-ct',
      title: '非增强CT',
      titleEn: 'Non-contrast CT',
      blurb: '常用来看高密度影。这是成像百科，不是诊断。',
      blurbEn: 'Often used to look for dense shadows. Imaging encyclopedia, not a diagnosis.',
      kind: 'ct',
      imageUrl: '/kuaixiaosan/imaging/noncontrast-ct.jpg',
      wikiUrlZh: 'https://zh.wikipedia.org/wiki/%E8%AE%A1%E7%AE%97%E6%9C%BA%E6%96%AD%E5%B1%82%E6%89%AB%E6%8F%8F',
      wikiUrlEn: 'https://en.wikipedia.org/wiki/CT_scan',
      credit: '肾结石快消散媒体包',
    },
  ],
};

function mockKuaixiaosanFetch() {
  return jest.fn().mockImplementation((url: RequestInfo) => {
    const href = String(url);
    if (href.includes('/lalem/') || href.includes('/shuileme/')) {
      return Promise.reject(new Error('肾结石快消散 must not call /lalem/ or /shuileme/'));
    }
    if (href.includes('/kuaixiaosan/chat')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          reply: '腰哪里更疼？先小口喝水，滤过尿液。发热加腰痛要立刻就医。这不是诊断。',
        }),
      });
    }
    if (href.includes('/kuaixiaosan/wiki')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          title: '肾结石',
          extract: '肾脏或尿路中的固体结晶。',
          lang: 'zh',
          sourceUrl: 'https://zh.wikipedia.org/wiki/%E8%82%BE%E7%BB%93%E7%9F%B3',
        }),
      });
    }
    if (href.includes('/kuaixiaosan/imaging')) {
      return Promise.resolve({ ok: true, status: 200, json: async () => imaging });
    }
    if (href.includes('/kuaixiaosan/lore')) {
      return Promise.resolve({ ok: true, status: 200, json: async () => lore });
    }
    if (href.includes('/kuaixiaosan/recover')) {
      return Promise.resolve({ ok: true, status: 200, json: async () => recover });
    }
    if (href.includes('/kuaixiaosan/cases')) {
      return Promise.resolve({ ok: true, status: 200, json: async () => cases });
    }
    return Promise.resolve({ ok: true, status: 200, json: async () => stones });
  }) as jest.Mock;
}

function cardTitleButton(name: string): HTMLElement {
  const img = screen.getByRole('img', { name });
  const btn = img.closest('article')?.querySelector('.kx-card-open');
  if (!btn) throw new Error(`missing title control for ${name}`);
  return btn as HTMLElement;
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  window.history.pushState({}, '', '/kuaixiaosan');
  global.fetch = mockKuaixiaosanFetch();
});

afterEach(() => {
  jest.useRealTimers();
});

test('fresh visit shows 肾结石快消散, not officer nav or other lounge worlds', async () => {
  render(<Kuaixiaosan />);
  expect(screen.getByRole('heading', { name: '肾结石快消散' })).toBeInTheDocument();
  expect(screen.getByText('快消散')).toBeInTheDocument();
  expect(screen.getByText(/已看/)).toBeInTheDocument();
  const hero = await screen.findByRole('img', { name: '草酸钙结石' });
  await waitFor(() => expect(hero).toHaveAttribute('src', '/kuaixiaosan/stones/calcium-oxalate-kidney.jpg'));
  expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  expect(document.querySelectorAll('.kx-dock button')).toHaveLength(6);
  expect(screen.getByRole('button', { name: '石' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '例' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '复' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '典' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '影' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '聊' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '好了' })).toBeInTheDocument();
  expect(document.querySelector('.fr-page')).toBeNull();
  expect(document.documentElement).toHaveClass('kx-world');
  expect(document.documentElement).not.toHaveClass('ll-world');
  expect(document.documentElement).not.toHaveClass('sm-world');
  expect(document.querySelector('video')).toBeNull();
});

test('English toggle is not the first-visit default even if navigator is en-US', () => {
  Object.defineProperty(window.navigator, 'language', { configurable: true, value: 'en-US' });
  Object.defineProperty(window.navigator, 'languages', { configurable: true, value: ['en-US'] });
  render(<Kuaixiaosan />);
  expect(screen.getByRole('heading', { name: '肾结石快消散' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '石' })).toBeInTheDocument();
});

test('stone title opens a local photo sheet without wikipedia links', async () => {
  render(<Kuaixiaosan />);
  await screen.findByRole('img', { name: '草酸钙结石' });
  await userEvent.click(cardTitleButton('草酸钙结石'));
  const sheet = await screen.findByRole('dialog', { name: '草酸钙结石' });
  expect(sheet.querySelector('img.kx-sheet-hero')).toHaveAttribute(
    'src',
    '/kuaixiaosan/stones/calcium-oxalate-kidney.jpg'
  );
  expect(sheet.querySelectorAll('.kx-sheet-chip').length).toBeGreaterThan(0);
  expect(within(sheet).queryByRole('link', { name: /维基|Wiki|Wikipedia/i })).toBeNull();
  expect(document.querySelectorAll('a[href*="wikipedia.org"]')).toHaveLength(0);
  expect(document.querySelector('video')).toBeNull();
});

test('composition filter hides non-matching stones', async () => {
  render(<Kuaixiaosan />);
  await screen.findByRole('img', { name: '草酸钙结石' });
  expect(screen.getByRole('img', { name: '尿酸结石' })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: '草酸钙' }));
  expect(screen.getByRole('img', { name: '草酸钙结石' })).toBeInTheDocument();
  expect(screen.queryByRole('img', { name: '尿酸结石' })).not.toBeInTheDocument();
});

test('lore sheet is encyclopedia, not a diagnosis', async () => {
  render(<Kuaixiaosan />);
  await userEvent.click(screen.getByRole('button', { name: '典' }));
  const loreImg = await screen.findByRole('img', { name: '结石怎样形成' });
  expect(loreImg.closest('a')).toBeNull();
  await userEvent.click(cardTitleButton('结石怎样形成'));
  const sheet = await screen.findByRole('dialog', { name: '结石怎样形成' });
  expect(sheet).toHaveTextContent(/不能替代医疗|not medical/i);
  expect(sheet.textContent || '').not.toMatch(/you have|你患有/i);
  expect(within(sheet).queryByRole('link', { name: /Wikipedia/i })).toBeNull();
  expect(within(sheet).getByRole('link', { name: 'NHS' })).toHaveAttribute(
    'href',
    'https://www.nhs.uk/conditions/kidney-stones/'
  );
});

test('case sheet is a third-person vignette, not a personal diagnosis', async () => {
  render(<Kuaixiaosan />);
  await userEvent.click(screen.getByRole('button', { name: '例' }));
  await screen.findByRole('img', { name: '夜里腰侧绞痛' });
  await userEvent.click(cardTitleButton('夜里腰侧绞痛'));
  const sheet = await screen.findByRole('dialog', { name: '夜里腰侧绞痛' });
  expect(sheet).toHaveTextContent(/有人/);
  expect(sheet).toHaveTextContent(/不能替代医疗|not medical/i);
  expect(sheet.textContent || '').not.toMatch(/you have|你患有/i);
});

test('no sit-alert after five minutes', () => {
  jest.useFakeTimers();
  const start = 1_700_000_000_000;
  jest.setSystemTime(start);
  render(<Kuaixiaosan />);
  act(() => {
    jest.setSystemTime(start + 5 * 60 * 1000);
    jest.advanceTimersByTime(1000);
  });
  expect(screen.queryByRole('dialog', { name: '久坐警报' })).not.toBeInTheDocument();
  expect(screen.queryByRole('dialog', { name: /sit alert/i })).not.toBeInTheDocument();
  jest.useRealTimers();
});

test('Kuaixiaosan source does not use Notification, video, or sibling lounge APIs', () => {
  const src = readFileSync(join(__dirname, 'Kuaixiaosan.tsx'), 'utf8');
  expect(src).not.toMatch(/Notification/);
  expect(src).not.toMatch(/requestPermission/);
  expect(src).not.toMatch(/<video/);
  expect(src).not.toMatch(/youtube|douyin|tiktok/i);
  expect(src).not.toMatch(/\/lalem\//);
  expect(src).not.toMatch(/\/shuileme\//);
  expect(src).not.toMatch(/#c6a56a/);
  expect(src).not.toMatch(/#ff4d8d/);
  expect(src).not.toMatch(/#7ee0ff/);
  expect(src).not.toMatch(/#c9f07a/);
});

test('stone cards appear before every photo src is assigned', async () => {
  render(<Kuaixiaosan />);
  expect(await screen.findByText('草酸钙结石')).toBeInTheDocument();
  expect(screen.getByText('尿酸结石')).toBeInTheDocument();
  expect(screen.getByText('磷酸铵镁鹿角石')).toBeInTheDocument();
  expect(document.querySelectorAll('.kx-ph').length).toBeGreaterThanOrEqual(3);
  await waitFor(() => {
    const queued = Array.from(document.querySelectorAll('.kx-gallery img')) as HTMLImageElement[];
    expect(queued.length).toBeGreaterThanOrEqual(3);
    expect(queued.filter((img) => img.getAttribute('src')).length).toBe(2);
  });
  const imgs = Array.from(document.querySelectorAll('.kx-gallery img')) as HTMLImageElement[];
  const withSrc = imgs.filter((img) => img.getAttribute('src'));
  fireEvent.load(withSrc[0]);
  const later = imgs.find((img) => !withSrc.includes(img));
  expect(later?.getAttribute('src')).toBe('/kuaixiaosan/stones/struvite-staghorn.jpg');
});

test('好了 freezes 已看 in place', async () => {
  jest.useFakeTimers();
  const start = 1_700_000_000_000;
  jest.setSystemTime(start);
  render(<Kuaixiaosan />);
  fireEvent.click(screen.getByRole('button', { name: '好了' }));
  const frozen = screen.getByText(/已看/).textContent;
  act(() => {
    jest.setSystemTime(start + 12 * 1000);
    jest.advanceTimersByTime(2000);
  });
  expect(screen.getByText(/已看/).textContent).toBe(frozen);
  expect(screen.getByRole('heading', { name: '肾结石快消散' })).toBeInTheDocument();
  expect(window.location.pathname).toMatch(/^\/kuaixiaosan/);
  expect(document.querySelector('.fr-page')).toBeNull();
  expect(document.documentElement).toHaveClass('kx-world');
  const siblingCalls = (global.fetch as jest.Mock).mock.calls.filter((call) => {
    const href = String(call[0]);
    return href.includes('/lalem/') || href.includes('/shuileme/');
  });
  expect(siblingCalls).toHaveLength(0);
  jest.useRealTimers();
});

test('/kuaixiaosan/chat opens the 聊 dock inside 肾结石快消散', async () => {
  window.history.pushState({}, '', '/kuaixiaosan/chat');
  render(<Kuaixiaosan />);
  expect(screen.getByRole('heading', { name: '肾结石快消散' })).toBeInTheDocument();
  expect(screen.getByRole('textbox').tagName).toBe('TEXTAREA');
  expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  expect(window.location.pathname).toBe('/kuaixiaosan/chat');
});

test('聊 dock stays on the 肾结石快消散 app at /kuaixiaosan/chat', async () => {
  render(<Kuaixiaosan />);
  await userEvent.click(screen.getByRole('button', { name: '聊' }));
  expect(window.location.pathname).toBe('/kuaixiaosan/chat');
  expect(screen.getByRole('textbox').tagName).toBe('TEXTAREA');
  expect(screen.getByRole('heading', { name: '肾结石快消散' })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: '石' }));
  expect(window.location.pathname).toBe('/kuaixiaosan');
});

test('chat dock shows a recovery reply and a thinking status', async () => {
  let releaseChat: ((value: unknown) => void) | undefined;
  const inner = mockKuaixiaosanFetch();
  global.fetch = jest.fn().mockImplementation((url: RequestInfo, init?: RequestInit) => {
    const href = String(url);
    if (href.includes('/kuaixiaosan/chat')) {
      return new Promise((resolve) => {
        releaseChat = resolve;
      });
    }
    return inner(url, init);
  });
  render(<Kuaixiaosan />);
  await userEvent.click(screen.getByRole('button', { name: '聊' }));
  const box = screen.getByRole('textbox');
  expect(box.tagName).toBe('TEXTAREA');
  await userEvent.type(box, '腰好疼');
  await userEvent.click(screen.getByRole('button', { name: '发送' }));
  const status = await screen.findByRole('status');
  expect(status).toBeInTheDocument();
  expect(document.querySelector('.kx-chat-log')).toHaveAttribute('aria-busy', 'true');
  expect(window.getComputedStyle(status).color).not.toMatch(/#7ee0ff|#c9f07a|#c6a56a/i);
  await act(async () => {
    releaseChat?.({
      ok: true,
      status: 200,
      json: async () => ({
        reply: '腰哪里更疼？先小口喝水，滤过尿液。发热加腰痛要立刻就医。这不是诊断。',
      }),
    });
  });
  expect(await screen.findByText(/喝水|滤过/)).toBeInTheDocument();
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  expect(screen.getByText(/喝水|滤过/).textContent || '').not.toMatch(/you have|你患有/i);
  const chatCalls = (global.fetch as jest.Mock).mock.calls.filter((call) =>
    String(call[0]).includes('/kuaixiaosan/chat')
  );
  expect(chatCalls.length).toBeGreaterThan(0);
  expect(String(chatCalls[0][1]?.method || '')).toMatch(/POST/i);
  const siblingCalls = (global.fetch as jest.Mock).mock.calls.filter((call) => {
    const href = String(call[0]);
    return href.includes('/lalem/') || href.includes('/shuileme/');
  });
  expect(siblingCalls).toHaveLength(0);
  expect(document.querySelector('video')).toBeNull();
});

test('off-topic stone chat returns to recovery knowledge', async () => {
  global.fetch = jest.fn().mockImplementation((url: RequestInfo, init?: RequestInit) => {
    const href = String(url);
    if (href.includes('/kuaixiaosan/chat')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          reply: '这里只谈结石恢复：小口喝水、休息、滤过尿液。厨房剩菜和案件都不是这间休息室的课。',
        }),
      });
    }
    return mockKuaixiaosanFetch()(url, init);
  });
  render(<Kuaixiaosan />);
  await userEvent.click(screen.getByRole('button', { name: '聊' }));
  await userEvent.type(screen.getByRole('textbox'), 'officer case file and Fridge Raid leftovers and poop');
  await userEvent.click(screen.getByRole('button', { name: '发送' }));
  const reply = await screen.findByText(/结石恢复|滤过尿液/);
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
    if (href.includes('/kuaixiaosan/chat')) {
      return new Promise(() => {
        /* hang so thinking stays */
      });
    }
    return mockKuaixiaosanFetch()(url, init);
  });
  render(<Kuaixiaosan />);
  await userEvent.click(screen.getByRole('button', { name: '聊' }));
  await userEvent.type(screen.getByRole('textbox'), '腰好疼');
  await userEvent.click(screen.getByRole('button', { name: '发送' }));
  const status = await screen.findByRole('status');
  expect(status).toHaveClass('kx-think--static');
  window.matchMedia = prev;
});
