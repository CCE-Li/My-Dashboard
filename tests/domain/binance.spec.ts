import { describe, expect, it } from 'vitest';
import {
  buildSparklinePath,
  changePercent,
  extractCloses,
  normalizePosition,
  sortByPnlMagnitude,
  summarizePositions,
} from '@/domain/binance';
import type { RawPositionRisk } from '@/types/binance';

function raw(partial: Partial<RawPositionRisk>): RawPositionRisk {
  return {
    symbol: 'BTCUSDT',
    positionAmt: '0',
    entryPrice: '0',
    markPrice: '0',
    unRealizedProfit: '0',
    liquidationPrice: '0',
    leverage: '10',
    marginType: 'cross',
    positionSide: 'BOTH',
    notional: '0',
    ...partial,
  };
}

describe('normalizePosition', () => {
  it('空仓（positionAmt = 0）返回 null，币安会把所有交易对都返回一遍', () => {
    expect(normalizePosition(raw({ positionAmt: '0' }))).toBeNull();
  });

  it('正数为多头，负数为空头，数量取绝对值', () => {
    const long = normalizePosition(
      raw({ positionAmt: '0.5', entryPrice: '60000', markPrice: '62000', notional: '31000', unRealizedProfit: '1000' }),
    );
    expect(long).toMatchObject({ side: 'LONG', amount: 0.5 });

    const short = normalizePosition(
      raw({ positionAmt: '-0.5', entryPrice: '60000', markPrice: '58000', notional: '29000', unRealizedProfit: '1000' }),
    );
    expect(short).toMatchObject({ side: 'SHORT', amount: 0.5 });
  });

  it('ROE = 盈亏 / 保证金，保证金 = 名义价值 / 杠杆', () => {
    // 名义 10000、10x → 保证金 1000；盈亏 100 → ROE 10%
    const position = normalizePosition(
      raw({ positionAmt: '1', markPrice: '10000', notional: '10000', leverage: '10', unRealizedProfit: '100' }),
    );
    expect(position?.roePercent).toBeCloseTo(10, 6);
  });

  it('名义价值缺失时用 数量 × 标记价 兜底', () => {
    const position = normalizePosition(
      raw({ positionAmt: '2', markPrice: '100', notional: '', unRealizedProfit: '0', leverage: '5' }),
    );
    expect(position?.notional).toBe(200);
  });

  it('杠杆为 0 或缺失时按 1 处理，不会除零', () => {
    const position = normalizePosition(
      raw({ positionAmt: '1', markPrice: '100', notional: '100', leverage: '0', unRealizedProfit: '10' }),
    );
    expect(Number.isFinite(position?.roePercent ?? Number.NaN)).toBe(true);
  });

  it('字符串数值被正确解析，脏值退化为 0', () => {
    const position = normalizePosition(
      raw({ positionAmt: '1', markPrice: 'abc', entryPrice: '100', notional: '100', unRealizedProfit: '5' }),
    );
    expect(position?.markPrice).toBe(0);
    expect(position?.entryPrice).toBe(100);
  });
});

describe('summarizePositions', () => {
  it('汇总总盈亏与多空/胜负计数', () => {
    const positions = [
      { symbol: 'A', side: 'LONG' as const, amount: 1, entryPrice: 1, markPrice: 2, unrealizedPnl: 10, roePercent: 1, notional: 100, leverage: 1 },
      { symbol: 'B', side: 'SHORT' as const, amount: 1, entryPrice: 1, markPrice: 2, unrealizedPnl: -4, roePercent: -1, notional: 100, leverage: 1 },
      { symbol: 'C', side: 'LONG' as const, amount: 1, entryPrice: 1, markPrice: 2, unrealizedPnl: 0, roePercent: 0, notional: 100, leverage: 1 },
    ];
    expect(summarizePositions(positions)).toEqual({
      totalPnl: 6,
      longCount: 2,
      shortCount: 1,
      winnerCount: 1,
      loserCount: 1,
    });
  });

  it('空列表返回全 0', () => {
    expect(summarizePositions([])).toEqual({
      totalPnl: 0,
      longCount: 0,
      shortCount: 0,
      winnerCount: 0,
      loserCount: 0,
    });
  });
});

describe('changePercent', () => {
  it('按开盘价算百分比', () => {
    expect(changePercent(100, 110)).toBeCloseTo(10, 6);
    expect(changePercent(100, 90)).toBeCloseTo(-10, 6);
  });

  it('开盘价为 0 或非法时返回 0，避免 Infinity/NaN', () => {
    expect(changePercent(0, 100)).toBe(0);
    expect(changePercent(Number.NaN, 100)).toBe(0);
  });
});

describe('buildSparklinePath', () => {
  it('按 viewBox 生成折线，且价格越高 y 越小', () => {
    const path = buildSparklinePath([1, 2, 3], 10, 20);
    expect(path.startsWith('M ')).toBe(true);
    const coords = path
      .replace('M ', '')
      .split(' L ')
      .map((pair) => pair.split(',').map(Number));
    expect(coords).toHaveLength(3);
    // x 递增
    expect(coords[0]?.[0]).toBe(0);
    expect(coords[2]?.[0]).toBe(10);
    // y 递减（价格上涨 → y 变小）
    expect(coords[0]?.[1] as number).toBeGreaterThan(coords[2]?.[1] as number);
  });

  it('所有点相同时画一条居中的水平线，而不是空路径', () => {
    const path = buildSparklinePath([5, 5, 5], 10, 20);
    expect(path).not.toBe('');
    const ys = path
      .replace('M ', '')
      .split(' L ')
      .map((pair) => Number(pair.split(',')[1]));
    expect(new Set(ys).size).toBe(1);
    expect(ys[0]).toBeCloseTo(10, 1);
  });

  it('单点也能生成路径', () => {
    expect(buildSparklinePath([42], 10, 20)).toContain('0.00,');
  });

  it('空数组或非法尺寸返回空字符串', () => {
    expect(buildSparklinePath([], 10, 20)).toBe('');
    expect(buildSparklinePath([1, 2], 0, 20)).toBe('');
  });
});

describe('extractCloses', () => {
  it('取每根 K 线的第 5 列（收盘价）', () => {
    const klines = [
      [1, '1', '2', '0.5', '1.5', 0],
      [2, '1.5', '3', '1', '2.5', 0],
    ];
    expect(extractCloses(klines)).toEqual([1.5, 2.5]);
  });

  it('跳过收盘价非法的行', () => {
    const klines = [
      [1, '1', '2', '0.5', 'oops', 0],
      [2, '1.5', '3', '1', '2.5', 0],
    ];
    expect(extractCloses(klines)).toEqual([2.5]);
  });
});

describe('sortByPnlMagnitude', () => {
  it('按盈亏绝对值降序，浮亏大的也排前面', () => {
    const positions = [
      { symbol: 'A', side: 'LONG' as const, amount: 1, entryPrice: 1, markPrice: 1, unrealizedPnl: 5, roePercent: 0, notional: 1, leverage: 1 },
      { symbol: 'B', side: 'LONG' as const, amount: 1, entryPrice: 1, markPrice: 1, unrealizedPnl: -50, roePercent: 0, notional: 1, leverage: 1 },
      { symbol: 'C', side: 'LONG' as const, amount: 1, entryPrice: 1, markPrice: 1, unrealizedPnl: 20, roePercent: 0, notional: 1, leverage: 1 },
    ];
    expect(sortByPnlMagnitude(positions).map((item) => item.symbol)).toEqual(['B', 'C', 'A']);
  });
});
