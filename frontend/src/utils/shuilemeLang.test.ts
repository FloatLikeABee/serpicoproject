import {
  detectShuilemeLang,
  loadShuilemeLang,
  saveShuilemeLang,
  SHUILEME_LANG_KEY,
} from './shuilemeLang';

describe('shuileme lang storage', () => {
  beforeEach(() => {
    localStorage.clear();
    Object.defineProperty(window.navigator, 'language', { configurable: true, value: 'en-US' });
    Object.defineProperty(window.navigator, 'languages', { configurable: true, value: ['en-US'] });
  });

  it('opens cn even if navigator.language is en-US', () => {
    expect(detectShuilemeLang()).toBe('cn');
    expect(loadShuilemeLang()).toBe('cn');
  });

  it('saves to serpico.shuileme.lang and does not overwrite lalem lang', () => {
    localStorage.setItem('serpico.lalem.lang', 'us');
    saveShuilemeLang('us');
    expect(localStorage.getItem(SHUILEME_LANG_KEY)).toBe('us');
    expect(localStorage.getItem('serpico.lalem.lang')).toBe('us');
    expect(loadShuilemeLang()).toBe('us');
  });
});
