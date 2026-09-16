import { I18N_KEYS, t } from '../i18n/catalog';

describe('i18n catalog', () => {
  it('returns English nav labels for us', () => {
    expect(t('us', 'nav.fleet')).toBe('Action');
    expect(t('us', 'nav.cases')).toBe('Cases');
    expect(t('us', 'nav.pursue')).toBe('Pursue');
    expect(t('us', 'nav.board')).toBe('Board');
    expect(t('us', 'nav.chat')).toBe('AI Chat');
  });

  it('returns Simplified Chinese nav labels for cn', () => {
    expect(t('cn', 'nav.fleet')).toBe('行动');
    expect(t('cn', 'nav.cases')).toBe('案件');
    expect(t('cn', 'nav.pursue')).toBe('追踪');
    expect(t('cn', 'nav.board')).toBe('公告板');
    expect(t('cn', 'nav.chat')).toBe('智能助手');
  });

  it('labels the city pin desk Action and provides map search copy', () => {
    expect(t('us', 'chase.fleetTab')).toBe('Action');
    expect(t('cn', 'chase.fleetTab')).toBe('行动');
    expect(t('us', 'helper.fleetTab')).toBe('Action');
    expect(t('cn', 'helper.fleetTab')).toBe('行动');
    expect(t('us', 'chase.deskAria')).toBe('Action desk modules');
    expect(t('cn', 'chase.deskAria')).toBe('行动工作台模块');
    expect(t('us', 'map.search')).toBe('Search places or notes');
    expect(t('cn', 'map.search')).toBe('搜索地点或备注');
    expect(t('us', 'map.searchEmpty')).toBe('No places or notes matched');
    expect(t('cn', 'map.searchEmpty')).toBe('没有匹配的地点或备注');
    expect(t('us', 'map.searchAria')).toBe('Search places or notes');
    expect(t('cn', 'map.searchAria')).toBe('搜索地点或备注');
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
    expect(t('cn', 'hardData.sendMqtt')).toBe('发布 MQTT');
    expect(t('cn', 'hardData.mqttFail')).toMatch(/MQTT/);
    expect(t('us', 'hardData.sendMqtt')).toBe('Publish MQTT');
    expect(t('cn', 'hardData.mqttTitle')).toMatch(/MQTT/);
    expect(t('cn', 'hardData.prodMqtt')).toMatch(/MQTT/);
    expect(t('us', 'hardData.title')).toBe('Hard data ingest');
    expect(t('us', 'hardData.handleTitle')).toBe('Hardware data');
    expect(t('cn', 'hardData.handleTitle')).toBe('硬件数据');
    expect(t('cn', 'hardData.handleNotFound')).toMatch(/未登记/);
    expect(t('cn', 'hardData.when')).toBe('时间');
    expect(t('cn', 'hardData.source')).toBe('来源');
    expect(t('cn', 'hardData.topic')).toBe('主题');
    expect(t('cn', 'hardData.payload')).toBe('载荷');
    expect(t('us', 'account.title')).toBe('Account');
    expect(t('cn', 'account.title')).toBe('账户');
    expect(t('us', 'account.close')).toBe('Close');
    expect(t('cn', 'account.close')).toBe('关闭');
    expect(t('us', 'landing.title')).toBe('SERPICO');
    expect(t('cn', 'landing.requestTitle')).not.toBe('landing.requestTitle');
    expect(t('cn', 'join.title')).not.toBe('join.title');
  });

  it('returns Fridge Raid kitchen chrome in English and Simplified Chinese', () => {
    expect(t('us', 'fridgeRaid.title')).toBe('Fridge Raid');
    expect(t('cn', 'fridgeRaid.title')).toBe('翻冰箱');
    expect(t('us', 'fridgeRaid.opening')).toMatch(/fridge/i);
    expect(t('us', 'fridgeRaid.opening')).toMatch(/photo/i);
    expect(t('cn', 'fridgeRaid.opening')).toMatch(/冰箱/);
    expect(t('cn', 'fridgeRaid.opening')).toMatch(/拍/);
    expect(t('us', 'fridgeRaid.disclaimer')).toMatch(/not medical/i);
    expect(t('cn', 'fridgeRaid.disclaimer')).toMatch(/医疗/);
    expect(t('us', 'fridgeRaid.send')).toBe('Send');
    expect(t('cn', 'fridgeRaid.send')).toBe('发送');
    expect(t('us', 'fridgeRaid.photo')).toMatch(/photo/i);
    expect(t('cn', 'fridgeRaid.photo')).toMatch(/照片|拍照|图片/);
    expect(t('us', 'fridgeRaid.tryAgain')).toMatch(/try again/i);
    expect(t('cn', 'fridgeRaid.tryAgain')).not.toBe('fridgeRaid.tryAgain');
    expect(t('us', 'fridgeRaid.detail.close')).toMatch(/close/i);
    expect(t('cn', 'fridgeRaid.detail.close')).toMatch(/关闭/);
    expect(t('us', 'fridgeRaid.detail.busy')).not.toBe('fridgeRaid.detail.busy');
    expect(t('cn', 'fridgeRaid.detail.busy')).not.toBe('fridgeRaid.detail.busy');
    expect(t('us', 'fridgeRaid.detail.error')).not.toBe('fridgeRaid.detail.error');
    expect(t('us', 'fridgeRaid.detail.tryAgain')).toMatch(/try again/i);
    expect(t('us', 'fridgeRaid.detail.steps')).toMatch(/how|step/i);
    expect(t('cn', 'fridgeRaid.detail.steps')).toMatch(/做|步骤/);
    expect(t('us', 'fridgeRaid.detail.tcm')).toMatch(/tcm|season/i);
    expect(t('us', 'fridgeRaid.detail.goodFor')).toMatch(/good for/i);
    expect(t('cn', 'fridgeRaid.detail.goodFor')).toMatch(/宜|适合/);
    expect(t('us', 'fridgeRaid.detail.caution')).toMatch(/caution|go easy/i);
  });

  it('returns 拉了么 chrome in Simplified Chinese by default keys', () => {
    expect(t('cn', 'lalem.title')).toBe('拉了么');
    expect(t('cn', 'lalem.kicker')).toBe('来都来了');
    expect(t('cn', 'lalem.dock.toilets')).toBe('马桶');
    expect(t('cn', 'lalem.dock.hot')).toBe('热榜');
    expect(t('cn', 'lalem.dock.useful')).toBe('有用');
    expect(t('cn', 'lalem.disclaimer')).toMatch(/医疗|诊断/);
    expect(t('us', 'lalem.title')).not.toBe('拉了么');
    expect(t('us', 'lalem.langEn')).toBe('EN');
    expect(t('cn', 'lalem.langEn')).toBe('EN');
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
