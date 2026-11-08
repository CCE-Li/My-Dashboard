import { describe, expect, it } from 'vitest';
import {
  bytesToGib,
  formatBytes,
  formatUptime,
  normalizeServerMetrics,
  pickPrimaryDisk,
  severityOf,
  usagePercent,
} from '@/domain/server';
import type { RawServerMetrics, ServerDisk } from '@/types/server';

const GIB = 1024 ** 3;

describe('usagePercent', () => {
  it('常规占用率', () => {
    expect(usagePercent(50, 100)).toBe(50);
  });

  it('分母为 0 时返回 0，避免除零', () => {
    expect(usagePercent(10, 0)).toBe(0);
  });

  it('夹到 0–100', () => {
    expect(usagePercent(200, 100)).toBe(100);
    expect(usagePercent(-5, 100)).toBe(0);
  });
});

describe('bytesToGib / formatBytes', () => {
  it('GiB 一位小数', () => {
    expect(bytesToGib(2 * GIB)).toBe(2);
    expect(formatBytes(1.5 * GIB)).toBe('1.5 GiB');
  });

  it('超过 1024 GiB 改用 TiB', () => {
    expect(formatBytes(2048 * GIB)).toBe('2.00 TiB');
  });
});

describe('formatUptime', () => {
  it('天 + 小时', () => {
    expect(formatUptime(86_400 * 3 + 3600 * 5)).toBe('3 天 5 小时');
  });

  it('小时 + 分', () => {
    expect(formatUptime(3600 * 2 + 60 * 30)).toBe('2 小时 30 分');
  });

  it('不足一小时只显示分', () => {
    expect(formatUptime(60 * 12)).toBe('12 分');
  });

  it('负数按 0 处理', () => {
    expect(formatUptime(-10)).toBe('0 分');
  });
});

describe('severityOf', () => {
  it('80 以下正常', () => {
    expect(severityOf(79.9)).toBe('ok');
  });

  it('80 起警告', () => {
    expect(severityOf(80)).toBe('warn');
  });

  it('90 起严重', () => {
    expect(severityOf(90)).toBe('critical');
  });
});

describe('pickPrimaryDisk', () => {
  const disk = (mount: string): ServerDisk => ({
    mount,
    totalBytes: 100,
    usedBytes: 10,
    percent: 10,
  });

  it('优先挂载点 /', () => {
    expect(pickPrimaryDisk([disk('/data'), disk('/')])?.mount).toBe('/');
  });

  it('没有 / 时取第一个', () => {
    expect(pickPrimaryDisk([disk('/data'), disk('/home')])?.mount).toBe('/data');
  });

  it('空列表返回 null', () => {
    expect(pickPrimaryDisk([])).toBeNull();
  });
});

describe('normalizeServerMetrics', () => {
  it('完整返回', () => {
    const raw: RawServerMetrics = {
      hostname: 'cceli',
      platform: 'Linux 6.1',
      uptimeSec: 90061,
      loadAvg: [0.5, 0.4, 0.3],
      cpu: { usagePercent: 12.5, cores: 4 },
      memory: { totalBytes: 8 * GIB, usedBytes: 4 * GIB },
      disks: [{ mount: '/', totalBytes: 100 * GIB, usedBytes: 50 * GIB }],
      generatedAt: '2026-11-08T10:00:00.000Z',
    };
    const view = normalizeServerMetrics(raw);
    expect(view.hostname).toBe('cceli');
    expect(view.cpuPercent).toBe(12.5);
    expect(view.cores).toBe(4);
    expect(view.memoryPercent).toBe(50);
    expect(view.disk?.mount).toBe('/');
    expect(view.disk?.percent).toBe(50);
    expect(view.generatedAt).toBe('2026-11-08T10:00:00.000Z');
  });

  it('缺字段按 0/unknown 兜底，不抛错', () => {
    const view = normalizeServerMetrics({});
    expect(view.hostname).toBe('unknown');
    expect(view.platform).toBe('unknown');
    expect(view.cpuPercent).toBe(0);
    expect(view.memoryPercent).toBe(0);
    expect(view.disk).toBeNull();
    expect(view.loadAvg).toEqual([]);
    expect(view.generatedAt).toBeNull();
  });
});
