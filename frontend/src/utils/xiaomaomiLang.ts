import type { Nation } from './nation';
import { parseNation } from './nation';

export const XIAOMAOMI_LANG_KEY = 'serpico.xiaomaomi.lang';

export function loadXiaomaomiLang(): Nation {
  try {
    const stored = localStorage.getItem(XIAOMAOMI_LANG_KEY);
    if (stored) {
      return parseNation(stored);
    }
  } catch {
    /* ignore */
  }
  return 'cn';
}

export function saveXiaomaomiLang(nation: Nation) {
  try {
    localStorage.setItem(XIAOMAOMI_LANG_KEY, parseNation(nation));
  } catch (err) {
    console.warn('saveXiaomaomiLang failed', err);
  }
}

export function detectXiaomaomiLang(): Nation {
  try {
    const params = new URLSearchParams(window.location.search);
    const q = params.get('lang') || params.get('nation');
    if (q) {
      return parseNation(q);
    }
  } catch {
    /* ignore */
  }
  return loadXiaomaomiLang();
}
