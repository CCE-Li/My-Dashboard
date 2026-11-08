import { describe, expect, it } from 'vitest';
import { buildNapcatView, healthOf, normalizeUin } from '@/domain/napcat';

describe('normalizeUin', () => {
  it('数字转字符串', () => {
    expect(normalizeUin(10001)).toBe('10001');
  });

  it('字符串去空白', () => {
    expect(normalizeUin(' 10001 ')).toBe('10001');
  });

  it('缺省返回空串', () => {
    expect(normalizeUin(undefined)).toBe('');
  });

  it('NaN 返回空串', () => {
    expect(normalizeUin(Number.NaN)).toBe('');
  });
});

describe('buildNapcatView', () => {
  it('完整数据', () => {
    const view = buildNapcatView(
      { online: true, good: true },
      { app_name: 'NapCat.Onebot', app_version: '4.0.0', protocol_version: 'v11' },
      { user_id: 10001, nickname: 'bot' },
      12,
      5,
    );
    expect(view).toMatchObject({
      online: true,
      good: true,
      appName: 'NapCat.Onebot',
      appVersion: '4.0.0',
      protocolVersion: 'v11',
      uin: '10001',
      nickname: 'bot',
      friendCount: 12,
      groupCount: 5,
    });
  });

  it('缺字段时兜底', () => {
    const view = buildNapcatView({}, {}, {}, Number.NaN, 3);
    expect(view.online).toBe(false);
    expect(view.good).toBe(false);
    expect(view.appName).toBe('NapCat');
    expect(view.appVersion).toBe('unknown');
    expect(view.nickname).toBe('未登录');
    expect(view.friendCount).toBe(0);
    expect(view.groupCount).toBe(3);
  });
});

describe('healthOf', () => {
  it('未在线 → offline', () => {
    expect(healthOf({ online: false, good: true })).toBe('offline');
  });

  it('在线且正常 → online', () => {
    expect(healthOf({ online: true, good: true })).toBe('online');
  });

  it('在线但 good=false → degraded', () => {
    expect(healthOf({ online: true, good: false })).toBe('degraded');
  });
});
