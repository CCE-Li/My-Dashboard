import { describe, expect, it } from 'vitest';
import {
  buildQuotaBars,
  buildUsageView,
  isUsageSnapshot,
  normalizeQuotaConfig,
  sumTokensWithinHours,
} from '@/domain/usage';
import { lastNDayKeys, lastNHourKeys } from '@/utils/time';
import type { UsageSnapshot } from '@/types/usage';

function snapshot(partial: Partial<UsageSnapshot> = {}): UsageSnapshot {
  return {
    generatedAt: '2026-03-15T12:00:00.000Z',
    source: '~/.commandcode',
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

const NOW = new Date(2026, 2, 15, 12, 30);

describe('buildUsageView', () => {
  it('总 token = 输入 + 输出，缓存读不重复计入', () => {
    expect(buildUsageView(snapshot(), '24h', NOW).totalTokens).toBe(1_200);
  });

  it('fresh 输入 = 输入 − 缓存读', () => {
    expect(buildUsageView(snapshot(), '24h', NOW).freshInputTokens).toBe(250);
  });

  it('缓存命中率按缓存读 / 总输入计算', () => {
    expect(buildUsageView(snapshot(), '24h', NOW).cacheHitRate).toBe(75);
  });

  it('模型按 token 降序排列并给出占比', () => {
    const view = buildUsageView(snapshot(), '24h', NOW);
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
      '24h',
      NOW,
    );
    expect(view.cacheHitRate).toBe(0);
    expect(view.byModel).toEqual([]);
  });
});

describe('时间跨度', () => {
  it('小时档位：按连续小时轴补零，柱子数量等于档位配置', () => {
    const hourKeys = lastNHourKeys(24, NOW);
    const target = hourKeys[hourKeys.length - 2] as string;

    const view = buildUsageView(
      snapshot({
        byHour: [
          { hour: target, requests: 3, totalTokens: 9_000, costUsd: 0.1 },
          { hour: '2026-01-01T00', requests: 1, totalTokens: 1_000, costUsd: 0.1 },
        ],
      }),
      '24h',
      NOW,
    );

    expect(view.span).toBe('24h');
    expect(view.spanLabel).toBe('24H');
    expect(view.bars).toHaveLength(24);
    expect(view.bars[22]?.tokens).toBe(9_000);
    expect(view.bars[22]?.height).toBe(100);
    expect(view.bars[23]?.isCurrent).toBe(true);
    // 窗口只包含最近 24 小时，历史数据不计入
    expect(view.windowTokens).toBe(9_000);
  });

  it('拉长到 48 小时档位会纳入更早的小时', () => {
    const hourKeys = lastNHourKeys(48, NOW);
    const older = hourKeys[0] as string;

    const view = buildUsageView(
      snapshot({ byHour: [{ hour: older, requests: 1, totalTokens: 5_000, costUsd: 0.1 }] }),
      '48h',
      NOW,
    );

    expect(view.bars).toHaveLength(48);
    expect(view.spanLabel).toBe('48H');
    expect(view.windowTokens).toBe(5_000);
  });

  it('天档位：改用按天数据，并把没有用量的日子补成 0', () => {
    const dayKeys = lastNDayKeys(7, NOW);
    const today = dayKeys[dayKeys.length - 1] as string;
    const threeDaysAgo = dayKeys[dayKeys.length - 4] as string;

    const view = buildUsageView(
      snapshot({
        byDay: [
          { day: threeDaysAgo, requests: 2, totalTokens: 4_000, costUsd: 0.2 },
          { day: today, requests: 1, totalTokens: 2_000, costUsd: 0.1 },
        ],
      }),
      '7d',
      NOW,
    );

    expect(view.span).toBe('7d');
    expect(view.bars).toHaveLength(7);
    expect(view.bars[view.bars.length - 1]?.isCurrent).toBe(true);
    // 中间那天没有用量，必须是 0 而不是被跳过
    expect(view.bars[view.bars.length - 3]?.tokens).toBe(0);
    expect(view.windowTokens).toBe(6_000);
    // 柱高相对窗口峰值：4000 是峰值
    const peakBar = view.bars[view.bars.length - 4];
    expect(peakBar?.height).toBe(100);
  });

  it('天档位的刻度标签是 MM-DD，小时档位是 HH', () => {
    const dayView = buildUsageView(snapshot(), '7d', NOW);
    expect(dayView.bars[0]?.label).toMatch(/^\d{2}-\d{2}$/);

    const hourView = buildUsageView(snapshot(), '24h', NOW);
    expect(hourView.bars[0]?.label).toMatch(/^\d{2}$/);
  });

  it('窗口内完全没有数据时高度全为 0，且不除零', () => {
    const view = buildUsageView(snapshot(), '30d', NOW);
    expect(view.bars).toHaveLength(30);
    expect(view.bars.every((bar) => bar.height === 0)).toBe(true);
    expect(view.windowTokens).toBe(0);
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

describe('sumTokensWithinHours', () => {
  const hourKeys = lastNHourKeys(24, NOW);

  it('只累加窗口内的小时桶', () => {
    const snapshotWithHours = snapshot({
      byHour: [
        { hour: hourKeys[23] as string, requests: 1, totalTokens: 1_000, costUsd: 0 },
        { hour: hourKeys[22] as string, requests: 1, totalTokens: 2_000, costUsd: 0 },
        { hour: hourKeys[0] as string, requests: 1, totalTokens: 4_000, costUsd: 0 },
        { hour: '2026-01-01T00', requests: 1, totalTokens: 8_000, costUsd: 0 },
      ],
    });

    // 5 小时窗口：只含最近 5 个桶（hourKeys[19..23]）
    expect(sumTokensWithinHours(snapshotWithHours, 5, NOW)).toBe(3_000);
    // 24 小时窗口：还包含最早的桶
    expect(sumTokensWithinHours(snapshotWithHours, 24, NOW)).toBe(7_000);
  });

  it('没有小时数据时返回 0 而不是 NaN', () => {
    expect(sumTokensWithinHours(snapshot(), 5, NOW)).toBe(0);
  });
});

describe('normalizeQuotaConfig', () => {
  it('脏数据一律收敛成 0，不让手改过的值把界面搞崩', () => {
    expect(normalizeQuotaConfig(null)).toEqual({ tokens5h: 0, tokens24h: 0, creditUsd: 0 });
    expect(normalizeQuotaConfig('nope')).toEqual({ tokens5h: 0, tokens24h: 0, creditUsd: 0 });
    expect(normalizeQuotaConfig({ tokens5h: -5, tokens24h: 'x', creditUsd: Number.NaN })).toEqual({
      tokens5h: 0,
      tokens24h: 0,
      creditUsd: 0,
    });
  });

  it('合法数值原样保留', () => {
    expect(normalizeQuotaConfig({ tokens5h: 1e6, tokens24h: 5e6, creditUsd: 50 })).toEqual({
      tokens5h: 1_000_000,
      tokens24h: 5_000_000,
      creditUsd: 50,
    });
  });
});

describe('buildQuotaBars', () => {
  const hourKeys = lastNHourKeys(24, NOW);
  const withHours = snapshot({
    byHour: [
      { hour: hourKeys[23] as string, requests: 1, totalTokens: 20_000_000, costUsd: 0 },
      { hour: hourKeys[20] as string, requests: 1, totalTokens: 10_000_000, costUsd: 0 },
    ],
  });

  it('三条进度：5H / 24H 用 token，总额度用美元', () => {
    const bars = buildQuotaBars(withHours, { tokens5h: 0, tokens24h: 0, creditUsd: 0 }, NOW);
    expect(bars.map((bar) => bar.id)).toEqual(['5h', '24h', 'credit']);
    expect(bars.map((bar) => bar.unit)).toEqual(['tokens', 'tokens', 'usd']);
    expect(bars[0]?.used).toBe(30_000_000);
    expect(bars[1]?.used).toBe(30_000_000);
    // 总额度取累计费用
    expect(bars[2]?.used).toBe(0.5);
  });

  it('未配置配额时不画进度，也不要出现 NaN', () => {
    const bars = buildQuotaBars(withHours, { tokens5h: 0, tokens24h: 0, creditUsd: 0 }, NOW);
    for (const bar of bars) {
      expect(bar.configured).toBe(false);
      expect(bar.percent).toBe(0);
    }
  });

  it('配置后按百分比计算', () => {
    const bars = buildQuotaBars(withHours, { tokens5h: 60_000_000, tokens24h: 200_000_000, creditUsd: 1 }, NOW);
    expect(bars[0]?.configured).toBe(true);
    expect(bars[0]?.percent).toBe(50);
    expect(bars[1]?.percent).toBe(15);
    expect(bars[2]?.percent).toBe(50);
  });

  it('超额时封顶 100%，不会画出溢出的进度条', () => {
    const bars = buildQuotaBars(withHours, { tokens5h: 1_000, tokens24h: 1_000, creditUsd: 0.1 }, NOW);
    expect(bars[0]?.percent).toBe(100);
    expect(bars[1]?.percent).toBe(100);
    expect(bars[2]?.percent).toBe(100);
  });
});
