export type Nation = 'us' | 'cn';

export const DEFAULT_NATION: Nation = 'us';

/** Mainland PRC IANA zones. HK / Macau / Taipei are not China mode. */
const MAINLAND_CHINA_TIME_ZONES = new Set([
  'Asia/Shanghai',
  'Asia/Urumqi',
  'Asia/Chongqing',
  'Asia/Harbin',
  'Asia/Kashgar',
  'PRC',
]);

/**
 * Pre-select nation from access area. Pass `timeZone` in tests;
 * otherwise uses the browser IANA zone (sessionStorage `serpico.geo.tz.v1` override for verification).
 */
export function detectAccessNation(timeZone?: string): Nation {
  try {
    let tz = (timeZone ?? '').trim();
    if (!tz) {
      try {
        tz = (sessionStorage.getItem('serpico.geo.tz.v1') || '').trim();
      } catch {
        /* ignore */
      }
    }
    if (!tz) {
      tz = (Intl.DateTimeFormat().resolvedOptions().timeZone || '').trim();
    }
    if (MAINLAND_CHINA_TIME_ZONES.has(tz)) return 'cn';
    return DEFAULT_NATION;
  } catch {
    return DEFAULT_NATION;
  }
}

export function parseNation(raw: string | null | undefined): Nation {
  const v = (raw || '').trim().toLowerCase();
  if (v === 'cn' || v === 'china' || v === 'zh' || v === 'zh-cn' || v === 'zh_cn' || v === 'zh-hans') {
    return 'cn';
  }
  return 'us';
}

const key = (userId: string) => `serpico.account.nation.v1.${userId || 'guest'}`;
const explicitKey = (userId: string) => `serpico.account.nation.explicit.v1.${userId || 'guest'}`;

export function loadNation(userId: string): Nation {
  try {
    return parseNation(localStorage.getItem(key(userId)));
  } catch {
    return DEFAULT_NATION;
  }
}

const LAST_KEY = 'serpico.last.nation.v1';

export function loadLastNation(): Nation {
  try {
    return parseNation(localStorage.getItem(LAST_KEY));
  } catch {
    return DEFAULT_NATION;
  }
}

export function saveLastNation(nation: Nation) {
  try {
    localStorage.setItem(LAST_KEY, parseNation(nation));
  } catch (err) {
    console.warn('saveLastNation failed', err);
  }
}

export function saveNation(userId: string, nation: Nation) {
  try {
    const n = parseNation(nation);
    localStorage.setItem(key(userId), n);
    saveLastNation(n);
  } catch (err) {
    console.warn('saveNation failed', err);
  }
}

export function hasExplicitNation(userId: string): boolean {
  try {
    if (localStorage.getItem(explicitKey(userId)) === '1') return true;
    const stored = localStorage.getItem(key(userId));
    return stored != null && parseNation(stored) === 'cn';
  } catch {
    return false;
  }
}

/** Persist nation and mark it as chosen on Cases → Account. */
export function saveExplicitNation(userId: string, nation: Nation) {
  saveNation(userId, nation);
  try {
    localStorage.setItem(explicitKey(userId), '1');
  } catch (err) {
    console.warn('saveExplicitNation failed', err);
  }
}

/**
 * Nation for this login: Account (or grandfathered cn) wins; otherwise access area.
 */
export function resolveSessionNation(userId: string, opts?: { timeZone?: string }): Nation {
  if (hasExplicitNation(userId)) {
    return loadNation(userId);
  }
  return detectAccessNation(opts?.timeZone);
}

function hasExplicitNationFlag(userId: string): boolean {
  try {
    return localStorage.getItem(explicitKey(userId)) === '1';
  } catch {
    return false;
  }
}

/**
 * Remote `users.nation` defaults to us in SQLite. Ignore that default unless
 * this account chose nation on Account. Remote cn is never a column default.
 */
export function shouldApplyRemoteNation(userId: string, remote: Nation | string | null | undefined): boolean {
  if (remote == null || String(remote).trim() === '') return false;
  if (parseNation(remote) === 'cn') return true;
  return hasExplicitNationFlag(userId);
}

/**
 * Resolve account nation for a user. An explicit value (including `us`) wins
 * over a previously stored `cn` so Cases → Account can switch back.
 */
export function resolveAccountNation(userId: string, explicit?: Nation | string | null): Nation {
  if (explicit != null && String(explicit).trim() !== '') {
    return parseNation(explicit);
  }
  return loadNation(userId);
}
