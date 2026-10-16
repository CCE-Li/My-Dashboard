import { describe, expect, it } from 'vitest';
import {
  DEFAULT_USAGE_SPAN,
  getUsageSpan,
  isUsageSpanId,
  stepUsageSpan,
  USAGE_SPANS,
} from '@/config/usageSpans';

describe('用量跨度档位', () => {
  it('默认是 24 小时', () => {
    expect(DEFAULT_USAGE_SPAN).toBe('24h');
    expect(getUsageSpan(DEFAULT_USAGE_SPAN).label).toBe('24H');
  });

  it('档位按跨度从短到长排列', () => {
    expect(USAGE_SPANS.map((span) => span.id)).toEqual(['24h', '48h', '7d', '14d', '30d']);
  });

  it('小时档位只保留在采集器覆盖的 48 小时内', () => {
    const hourSpans = USAGE_SPANS.filter((span) => span.granularity === 'hour');
    for (const span of hourSpans) {
      expect(span.count).toBeLessThanOrEqual(48);
    }
  });

  it('id 唯一且柱子数量为正', () => {
    const ids = USAGE_SPANS.map((span) => span.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const span of USAGE_SPANS) {
      expect(span.count).toBeGreaterThan(0);
    }
  });

  it('无法识别的 id 回落到默认档位', () => {
    expect(getUsageSpan('99y').id).toBe('24h');
  });

  it('isUsageSpanId 只认已登记的档位', () => {
    expect(isUsageSpanId('7d')).toBe(true);
    expect(isUsageSpanId('99y')).toBe(false);
    expect(isUsageSpanId(undefined)).toBe(false);
  });
});

describe('stepUsageSpan', () => {
  it('向上滚（-1）拉近：跨度变短', () => {
    expect(stepUsageSpan('7d', -1)).toBe('48h');
    expect(stepUsageSpan('30d', -1)).toBe('14d');
  });

  it('向下滚（1）拉远：跨度变长', () => {
    expect(stepUsageSpan('24h', 1)).toBe('48h');
    expect(stepUsageSpan('14d', 1)).toBe('30d');
  });

  it('到边界后钳制，不会越界或循环', () => {
    expect(stepUsageSpan('24h', -1)).toBe('24h');
    expect(stepUsageSpan('30d', 1)).toBe('30d');
  });

  it('连续滚动可从一头走到另一头', () => {
    let current = '24h';
    for (let i = 0; i < 10; i += 1) current = stepUsageSpan(current, 1);
    expect(current).toBe('30d');

    for (let i = 0; i < 10; i += 1) current = stepUsageSpan(current, -1);
    expect(current).toBe('24h');
  });

  it('起点是脏数据时从默认档位开始走', () => {
    expect(stepUsageSpan('garbage', 1)).toBe('48h');
    expect(stepUsageSpan('garbage', -1)).toBe('24h');
  });
});
