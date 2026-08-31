import {
  DEFAULT_NATION,
  detectAccessNation,
  loadNation,
  parseNation,
  resolveAccountNation,
  resolveSessionNation,
  saveExplicitNation,
  saveNation,
  shouldApplyRemoteNation,
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

describe('detectAccessNation', () => {
  it('maps mainland China IANA zones to cn', () => {
    expect(detectAccessNation('Asia/Shanghai')).toBe('cn');
    expect(detectAccessNation('Asia/Urumqi')).toBe('cn');
  });

  it('maps non-China zones including HK/TW/MO to us', () => {
    expect(detectAccessNation('America/Chicago')).toBe('us');
    expect(detectAccessNation('Europe/Paris')).toBe('us');
    expect(detectAccessNation('Asia/Hong_Kong')).toBe('us');
    expect(detectAccessNation('Asia/Taipei')).toBe('us');
    expect(detectAccessNation('Asia/Macau')).toBe('us');
  });

  it('defaults unknown or empty area to us', () => {
    expect(detectAccessNation('')).toBe('us');
    expect(detectAccessNation('Not/AZone')).toBe('us');
  });
});

describe('resolveSessionNation', () => {
  const userId = 'demo-serpico';

  beforeEach(() => {
    localStorage.clear();
  });

  it('uses geo when nothing is stored', () => {
    expect(resolveSessionNation(userId, { timeZone: 'Asia/Shanghai' })).toBe('cn');
  });

  it('treats legacy stored us without explicit flag as unset', () => {
    saveNation(userId, 'us');
    expect(resolveSessionNation(userId, { timeZone: 'Asia/Shanghai' })).toBe('cn');
  });

  it('grandfathers stored cn without an explicit flag', () => {
    saveNation(userId, 'cn');
    expect(resolveSessionNation(userId, { timeZone: 'America/Chicago' })).toBe('cn');
  });

  it('keeps explicit us over a China time zone', () => {
    saveExplicitNation(userId, 'us');
    expect(resolveSessionNation(userId, { timeZone: 'Asia/Shanghai' })).toBe('us');
  });

  it('keeps explicit cn over a United States time zone', () => {
    saveExplicitNation(userId, 'cn');
    expect(resolveSessionNation(userId, { timeZone: 'America/Chicago' })).toBe('cn');
  });
});

describe('shouldApplyRemoteNation', () => {
  const userId = 'demo-serpico';

  beforeEach(() => {
    localStorage.clear();
  });

  it('does not let remote us override geo cn without explicit flag', () => {
    expect(shouldApplyRemoteNation(userId, 'us')).toBe(false);
  });

  it('applies remote cn even without explicit flag', () => {
    expect(shouldApplyRemoteNation(userId, 'cn')).toBe(true);
  });

  it('applies remote us when Account nation is explicit', () => {
    saveExplicitNation(userId, 'us');
    expect(shouldApplyRemoteNation(userId, 'us')).toBe(true);
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

  it('explicit us wins over stored cn on the same id', () => {
    saveNation('demo-serpico', 'cn');
    expect(resolveAccountNation('demo-serpico', 'us')).toBe('us');
  });

  it('explicit cn still applies when stored is us', () => {
    saveNation('demo-serpico', 'us');
    expect(resolveAccountNation('demo-serpico', 'cn')).toBe('cn');
  });

  it('falls back to stored nation when explicit is omitted', () => {
    saveNation('demo-serpico', 'cn');
    expect(resolveAccountNation('demo-serpico')).toBe('cn');
  });
});
