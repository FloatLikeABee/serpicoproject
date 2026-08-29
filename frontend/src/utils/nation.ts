export type Nation = 'us' | 'cn';

export const DEFAULT_NATION: Nation = 'us';

export function parseNation(raw: string | null | undefined): Nation {
  const v = (raw || '').trim().toLowerCase();
  if (v === 'cn' || v === 'china' || v === 'zh' || v === 'zh-cn' || v === 'zh_cn' || v === 'zh-hans') {
    return 'cn';
  }
  return 'us';
}

const key = (userId: string) => `serpico.account.nation.v1.${userId || 'guest'}`;

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
