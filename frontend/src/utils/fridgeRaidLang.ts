import type { Nation } from './nation';
import { parseNation } from './nation';

export const FRIDGE_RAID_LANG_KEY = 'serpico.fridgeRaid.lang';

export function loadFridgeRaidLang(): Nation {
  try {
    const stored = localStorage.getItem(FRIDGE_RAID_LANG_KEY);
    if (stored) {
      return parseNation(stored);
    }
  } catch {
    /* ignore */
  }
  return 'us';
}

export function saveFridgeRaidLang(nation: Nation) {
  try {
    localStorage.setItem(FRIDGE_RAID_LANG_KEY, parseNation(nation));
  } catch (err) {
    console.warn('saveFridgeRaidLang failed', err);
  }
}

export function detectFridgeRaidLang(): Nation {
  try {
    const params = new URLSearchParams(window.location.search);
    const q = params.get('lang') || params.get('nation');
    if (q) {
      return parseNation(q);
    }
  } catch {
    /* ignore */
  }
  try {
    const stored = localStorage.getItem(FRIDGE_RAID_LANG_KEY);
    if (stored) {
      return parseNation(stored);
    }
  } catch {
    /* ignore */
  }
  try {
    const langs = [navigator.language, ...((navigator.languages as string[]) || [])];
    if (langs.some((l) => /^zh\b/i.test(l || ''))) {
      return 'cn';
    }
  } catch {
    /* ignore */
  }
  return 'us';
}
