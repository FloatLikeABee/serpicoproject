import {
  detectLalemLang,
  loadLalemLang,
  saveLalemLang,
  LALEM_LANG_KEY,
} from './lalemLang';

describe('lalem lang storage', () => {
  beforeEach(() => {
    localStorage.clear();
    Object.defineProperty(window.navigator, 'language', { configurable: true, value: 'en-US' });
    Object.defineProperty(window.navigator, 'languages', { configurable: true, value: ['en-US'] });
  });

  it('opens cn even if navigator.language is en-US', () => {
    expect(detectLalemLang()).toBe('cn');
    expect(loadLalemLang()).toBe('cn');
  });

  it('saves to serpico.lalem.lang and does not overwrite officer last nation', () => {
    localStorage.setItem('serpico.last.nation.v1', 'us');
    saveLalemLang('us');
    expect(localStorage.getItem(LALEM_LANG_KEY)).toBe('us');
    expect(localStorage.getItem('serpico.last.nation.v1')).toBe('us');
    expect(loadLalemLang()).toBe('us');
  });
});
