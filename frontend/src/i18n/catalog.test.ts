import { I18N_KEYS, t } from '../i18n/catalog';

describe('i18n catalog', () => {
  it('returns English nav labels for us', () => {
    expect(t('us', 'nav.fleet')).toBe('Fleet');
    expect(t('us', 'nav.cases')).toBe('Cases');
    expect(t('us', 'nav.pursue')).toBe('Pursue');
    expect(t('us', 'nav.board')).toBe('Board');
    expect(t('us', 'nav.chat')).toBe('AI Chat');
  });

  it('returns Simplified Chinese nav labels for cn', () => {
    expect(t('cn', 'nav.fleet')).toBe('警力');
    expect(t('cn', 'nav.cases')).toBe('案件');
    expect(t('cn', 'nav.pursue')).toBe('追踪');
    expect(t('cn', 'nav.board')).toBe('公告板');
    expect(t('cn', 'nav.chat')).toBe('智能助手');
  });

  it('has Chinese strings for every English catalog key', () => {
    I18N_KEYS.forEach((key) => {
      expect(t('cn', key)).not.toBe(key);
    });
  });
});
