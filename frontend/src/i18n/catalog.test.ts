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

  it('returns Simplified Chinese interview helper chrome', () => {
    expect(t('cn', 'interview.tab')).toBe('讯问');
    expect(t('cn', 'interview.general')).toBe('综合');
    expect(t('cn', 'interview.send')).toBe('发送');
    expect(t('cn', 'interview.placeholder')).toMatch(/案情/);
  });

  it('returns Simplified Chinese pin helper and chat error wrappers', () => {
    expect(t('cn', 'pin.fillHint')).toMatch(/生成 AI 情报/);
    expect(t('cn', 'pin.tapPlace')).toMatch(/地图/);
    expect(t('cn', 'chat.commsIssue')).not.toMatch(/Copy that/);
    expect(t('cn', 'chat.headsUpPrefix')).not.toMatch(/Heads up/);
  });

  it('returns Simplified Chinese Pursue tag shorts (not Officer / Investigation)', () => {
    expect(t('cn', 'tag.short.police_officer')).not.toBe('Officer');
    expect(t('cn', 'tag.short.investigation')).not.toBe('Investigation');
    expect(t('cn', 'tag.short.police_officer')).toMatch(/[\u4e00-\u9fff]/);
    expect(t('cn', 'tag.kind.investigation')).toMatch(/[\u4e00-\u9fff]/);
    expect(t('us', 'tag.short.police_officer')).toBe('Officer');
    expect(t('us', 'tag.kind.investigation')).toBe('Investigation');
  });

  it('returns Simplified Chinese hard-data ingest chrome', () => {
    expect(t('cn', 'hardData.title')).toBe('硬数据接入');
    expect(t('cn', 'hardData.send')).toBe('提交样例');
    expect(t('cn', 'hardData.mqttTitle')).toMatch(/MQTT/);
    expect(t('cn', 'hardData.prodMqtt')).toMatch(/MQTT/);
    expect(t('us', 'hardData.title')).toBe('Hard data ingest');
  });

  it('returns Simplified Chinese Fleet kind labels used by chips and the pin modal', () => {
    expect(t('cn', 'fleet.short.station')).toMatch(/[\u4e00-\u9fff]/);
    expect(t('cn', 'fleet.kind.police_station')).toMatch(/[\u4e00-\u9fff]/);
    expect(t('cn', 'fleet.kind.personnel')).toMatch(/[\u4e00-\u9fff]/);
    expect(t('cn', 'fleet.kind.police_vehicle')).toMatch(/[\u4e00-\u9fff]/);
    expect(t('cn', 'fleet.kind.investigation')).toMatch(/[\u4e00-\u9fff]/);
    expect(t('us', 'fleet.kind.police_station')).toBe('Station / facility');
  });
});
