import type { Nation } from './nation';
import { parseNation } from './nation';

export const KUAIXIAOSAN_LANG_KEY = 'serpico.kuaixiaosan.lang';

export function loadKuaixiaosanLang(): Nation {
  try {
    const stored = localStorage.getItem(KUAIXIAOSAN_LANG_KEY);
    if (stored) {
      return parseNation(stored);
    }
  } catch {
    /* ignore */
  }
  return 'cn';
}

export function saveKuaixiaosanLang(nation: Nation) {
  try {
    localStorage.setItem(KUAIXIAOSAN_LANG_KEY, parseNation(nation));
  } catch (err) {
    console.warn('saveKuaixiaosanLang failed', err);
  }
}

export function detectKuaixiaosanLang(): Nation {
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
    const stored = localStorage.getItem(KUAIXIAOSAN_LANG_KEY);
    if (stored) {
      return parseNation(stored);
    }
  } catch {
    /* ignore */
  }
  return 'cn';
}
