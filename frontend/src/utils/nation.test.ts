import {
  DEFAULT_NATION,
  loadNation,
  parseNation,
  saveNation,
} from './nation';

describe('parseNation', () => {
  it('defaults to us', () => {
    expect(parseNation('')).toBe(DEFAULT_NATION);
    expect(parseNation('nope')).toBe('us');
  });

  it('accepts cn aliases', () => {
    expect(parseNation('cn')).toBe('cn');
    expect(parseNation('China')).toBe('cn');
    expect(parseNation('zh-CN')).toBe('cn');
  });
});

describe('nation storage is per user id', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('keeps cn on the same id after reload', () => {
    saveNation('demo-serpico', 'cn');
    expect(loadNation('demo-serpico')).toBe('cn');
  });

  it('does not leak nation to another user id', () => {
    saveNation('officer-a', 'cn');
    expect(loadNation('officer-b')).toBe('us');
  });
});
