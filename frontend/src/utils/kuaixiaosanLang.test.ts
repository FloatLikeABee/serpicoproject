import {
  detectKuaixiaosanLang,
  loadKuaixiaosanLang,
  saveKuaixiaosanLang,
  KUAIXIAOSAN_LANG_KEY,
} from './kuaixiaosanLang';

describe('kuaixiaosan lang storage', () => {
  beforeEach(() => {
    localStorage.clear();
    Object.defineProperty(window.navigator, 'language', { configurable: true, value: 'en-US' });
    Object.defineProperty(window.navigator, 'languages', { configurable: true, value: ['en-US'] });
  });

  it('opens cn even if navigator.language is en-US', () => {
    expect(detectKuaixiaosanLang()).toBe('cn');
    expect(loadKuaixiaosanLang()).toBe('cn');
  });

  it('saves to serpico.kuaixiaosan.lang and does not overwrite sibling lounge langs', () => {
    localStorage.setItem('serpico.lalem.lang', 'us');
    localStorage.setItem('serpico.shuileme.lang', 'us');
    saveKuaixiaosanLang('us');
    expect(localStorage.getItem(KUAIXIAOSAN_LANG_KEY)).toBe('us');
    expect(localStorage.getItem('serpico.lalem.lang')).toBe('us');
    expect(localStorage.getItem('serpico.shuileme.lang')).toBe('us');
    expect(loadKuaixiaosanLang()).toBe('us');
  });
});
