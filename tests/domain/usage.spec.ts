import { describe, expect, it } from 'vitest';
import { buildUsageView, isUsageSnapshot } from '@/domain/usage';
import { lastNHourKeys } from '@/utils/time';
import type { UsageSnapshot } from '@/types/usage';

function snapshot(partial: Partial<UsageSnapshot> = {}): UsageSnapshot {
  return {
    generatedAt: '2026-03-15T12:00:00.000Z',
    source: 'C:\\Users\\me\\.commandcode',
    sessionFiles: 2,
    totals: {
      requests: 10,
      inputTokens: 1_000,
      outputTokens: 200,
      cacheReadTokens: 750,
      costUsd: 0.5,
    },
    byModel: [
      {
        model: 'deepseek/deepseek-v4-flash',
        requests: 6,
        inputTokens: 600,
        outputTokens: 100,
        cacheReadTokens: 400,
        costUsd: 0.2,
      },
      {
        model: 'gpt-5.6-sol',
        requests: 4,
        inputTokens: 400,
        outputTokens: 100,
        cacheReadTokens: 350,
        costUsd: 0.3,
      },
    ],
    byDay: [],
    byHour: [],
    ...partial,
  };
}

describe('buildUsageView', () => {
  const now = new Date(2026, 2, 15, 12, 30);

  it('总 token = 输入 + 输出，缓存读不重复计入', () => {
    const view = buildUsageView(snapshot(), now);
    expect(view.totalTokens).toBe(1_200);
  });

  it('fresh 输入 = 输入 − 缓存读', () => {
    const view = buildUsageView(snapshot(), now);
    expect(view.freshInputTokens).toBe(250);
  });

  it('缓存命中率按缓存读 / 总输入计算', () => {
    const view = buildUsageView(snapshot(), now);
    expect(view.cacheHitRate).toBe(75);
  });

  it('模型按 token 降序排列并给出占比', () => {
    const view = buildUsageView(snapshot(), now);
    expect(view.byModel.map((row) => row.model)).toEqual([
      'deepseek/deepseek-v4-flash',
      'gpt-5.6-sol',
    ]);
    expect(view.byModel[0]?.totalTokens).toBe(700);
    expect(view.byModel[0]?.ratio).toBe(58.3);
    expect(view.byModel[1]?.totalTokens).toBe(500);
    expect(view.byModel[1]?.ratio).toBe(41.7);
  });

  it('输入为 0 时命中率为 0 而不是 NaN', () => {
    const view = buildUsageView(
      snapshot({
        totals: {
          requests: 0,
          inputTokens: 0,
          outputTokens: 0,
          cacheReadTokens: 0,
          costUsd: 0,
        },
        byModel: [],
      }),
      now,
    );
    expect(view.cacheHitRate).toBe(0);
    expect(view.byModel).toEqual([]);
  });

  it('24 小时柱状图按连续时间轴填充零值小时', () => {
    const hourKeys = lastNHourKeys(24, now);
    const targetHour = hourKeys[hourKeys.length - 2] as string;
    const view = buildUsageView(
      snapshot({
        byHour: [
          { hour: targetHour, requests: 3, totalTokens: 9_000, costUsd: 0.1 },
          { hour: '2026-01-01T00', requests: 1, totalTokens: 1_000, costUsd: 0.1 },
        ],
      }),
      now,
    );

    expect(view.hourly).toHaveLength(24);
    expect(view.hourly[view.hourly.length - 2]?.tokens).toBe(9_000);
    expect(view.hourly[view.hourly.length - 2]?.height).toBe(100);
    expect(view.hourly[view.hourly.length - 1]?.isCurrentHour).toBe(true);
    expect(view.hourlyTokens).toBe(9_000);
    // 窗口外的数据不进入柱状图
    expect(view.hourly.every((bar) => bar.tokens === 0 || bar.tokens === 9_000)).toBe(true);
  });

  it('没有小时数据时全部为 0 高度且不除零', () => {
    const view = buildUsageView(snapshot(), now);
    expect(view.hourly).toHaveLength(24);
    expect(view.hourly.every((bar) => bar.height === 0)).toBe(true);
  });
});

describe('isUsageSnapshot', () => {
  it('接受采集器产出的结构', () => {
    expect(isUsageSnapshot(snapshot())).toBe(true);
  });

  it('拒绝缺字段的结构', () => {
    expect(isUsageSnapshot(null)).toBe(false);
    expect(isUsageSnapshot({})).toBe(false);
    expect(isUsageSnapshot({ generatedAt: 'x', totals: {}, byModel: [], byDay: [] })).toBe(true);
    expect(isUsageSnapshot({ generatedAt: 'x', totals: null, byModel: [], byDay: [] })).toBe(false);
    expect(isUsageSnapshot({ generatedAt: 'x', totals: {}, byModel: 'nope', byDay: [] })).toBe(
      false,
    );
  });
});
