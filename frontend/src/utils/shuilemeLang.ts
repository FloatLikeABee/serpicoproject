import type { Nation } from './nation';
import { parseNation } from './nation';

export const SHUILEME_LANG_KEY = 'serpico.shuileme.lang';

export function loadShuilemeLang(): Nation {
  try {
    const stored = localStorage.getItem(SHUILEME_LANG_KEY);
    if (stored) {
      return parseNation(stored);
    }
  } catch {
    /* ignore */
  }
  return 'cn';
}

export function saveShuilemeLang(nation: Nation) {
  try {
    localStorage.setItem(SHUILEME_LANG_KEY, parseNation(nation));
  } catch (err) {
    console.warn('saveShuilemeLang failed', err);
  }
}

export function detectShuilemeLang(): Nation {
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
    const stored = localStorage.getItem(SHUILEME_LANG_KEY);
    if (stored) {
      return parseNation(stored);
    }
  } catch {
    /* ignore */
  }
  return 'cn';
}
