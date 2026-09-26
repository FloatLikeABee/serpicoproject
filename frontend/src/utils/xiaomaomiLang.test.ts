import {
  detectXiaomaomiLang,
  loadXiaomaomiLang,
  saveXiaomaomiLang,
  XIAOMAOMI_LANG_KEY,
} from './xiaomaomiLang';

describe('xiaomaomi lang storage', () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.pushState({}, '', '/xiaomaomi');
    Object.defineProperty(window.navigator, 'language', { configurable: true, value: 'en-US' });
    Object.defineProperty(window.navigator, 'languages', { configurable: true, value: ['en-US'] });
  });

  it('opens cn even if navigator.language is en-US', () => {
    expect(detectXiaomaomiLang()).toBe('cn');
    expect(loadXiaomaomiLang()).toBe('cn');
  });

  it('saves to serpico.xiaomaomi.lang and does not overwrite sibling lounge langs', () => {
    localStorage.setItem('serpico.lalem.lang', 'us');
    localStorage.setItem('serpico.shuileme.lang', 'us');
    localStorage.setItem('serpico.kuaixiaosan.lang', 'us');
    saveXiaomaomiLang('us');
    expect(localStorage.getItem(XIAOMAOMI_LANG_KEY)).toBe('us');
    expect(localStorage.getItem('serpico.lalem.lang')).toBe('us');
    expect(localStorage.getItem('serpico.shuileme.lang')).toBe('us');
    expect(localStorage.getItem('serpico.kuaixiaosan.lang')).toBe('us');
    expect(loadXiaomaomiLang()).toBe('us');
  });

  it('honors ?lang= without reading other lounge keys', () => {
    localStorage.setItem('serpico.lalem.lang', 'cn');
    window.history.pushState({}, '', '/xiaomaomi?lang=us');
    expect(detectXiaomaomiLang()).toBe('us');
    expect(localStorage.getItem('serpico.lalem.lang')).toBe('cn');
  });
});
