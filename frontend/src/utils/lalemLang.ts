import type { Nation } from './nation';
import { parseNation } from './nation';

export const LALEM_LANG_KEY = 'serpico.lalem.lang';

export function loadLalemLang(): Nation {
  try {
    const stored = localStorage.getItem(LALEM_LANG_KEY);
    if (stored) {
      return parseNation(stored);
    }
  } catch {
    /* ignore */
  }
  return 'cn';
}

export function saveLalemLang(nation: Nation) {
  try {
    localStorage.setItem(LALEM_LANG_KEY, parseNation(nation));
  } catch (err) {
    console.warn('saveLalemLang failed', err);
  }
}

export function detectLalemLang(): Nation {
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
    const stored = localStorage.getItem(LALEM_LANG_KEY);
    if (stored) {
      return parseNation(stored);
    }
  } catch {
    /* ignore */
  }
  return 'cn';
}
