import type {
  NormalizedPosition,
  PositionSummary,
  RawPositionRisk,
} from '@/types/binance';

/**
 * 币安数据的纯计算层：解析、汇总、迷你走势图路径。
 * 不碰网络、不碰 DOM，便于单测。
 */

function toNumber(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * 把 positionRisk 的一项折算成展示用的仓位。
 * 空仓（positionAmt 为 0）直接丢弃 —— 币安会把所有交易对都返回一遍。
 */
export function normalizePosition(raw: RawPositionRisk): NormalizedPosition | null {
  const amount = toNumber(raw.positionAmt);
  if (amount === 0) return null;

  const entryPrice = toNumber(raw.entryPrice);
  let markPrice = toNumber(raw.markPrice);
  // 两个版本字段拼写不同，取存在的那个
  const unrealizedPnl = toNumber(raw.unRealizedProfit ?? raw.unrealizedProfit);
  const leverage = toNumber(raw.leverage) || 1;
  const notional = Math.abs(toNumber(raw.notional)) || Math.abs(amount * markPrice);

  // /fapi/v2/account 的 positions 里没有 markPrice，用 名义价值 / 数量 反算
  if (markPrice === 0 && notional > 0) {
    markPrice = notional / Math.abs(amount);
  }

  // 保证金 = 名义价值 / 杠杆；ROE = 盈亏 / 保证金
  const margin = notional / leverage;
  const roePercent = margin > 0 ? (unrealizedPnl / margin) * 100 : 0;

  return {
    symbol: raw.symbol,
    side: amount > 0 ? 'LONG' : 'SHORT',
    amount: Math.abs(amount),
    entryPrice,
    markPrice,
    unrealizedPnl,
    roePercent,
    notional,
    leverage,
  };
}

/** 汇总持仓：总盈亏与多空/胜负计数，供磁贴顶部展示。 */
export function summarizePositions(positions: readonly NormalizedPosition[]): PositionSummary {
  let totalPnl = 0;
  let longCount = 0;
  let shortCount = 0;
  let winnerCount = 0;
  let loserCount = 0;

  for (const position of positions) {
    totalPnl += position.unrealizedPnl;
    if (position.side === 'LONG') longCount += 1;
    else shortCount += 1;
    if (position.unrealizedPnl > 0) winnerCount += 1;
    else if (position.unrealizedPnl < 0) loserCount += 1;
  }

  return { totalPnl, longCount, shortCount, winnerCount, loserCount };
}

/** 涨跌幅（%）。开盘价为 0 时返回 0，避免除零。 */
export function changePercent(open: number, close: number): number {
  if (!Number.isFinite(open) || open === 0) return 0;
  return ((close - open) / open) * 100;
}

/**
 * 把收盘价序列压成一条 SVG 折线路径（viewBox 坐标）。
 *
 * - 只有 0/1 个点、或所有点相同 → 画一条居中的水平线，而不是空路径
 * - y 轴翻转：价格越高 y 越小
 */
export function buildSparklinePath(values: readonly number[], width: number, height: number): string {
  if (values.length === 0 || width <= 0 || height <= 0) return '';

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min;
  const stepX = values.length > 1 ? width / (values.length - 1) : 0;

  const points = values.map((value, index) => {
    const x = index * stepX;
    const ratio = span === 0 ? 0.5 : (value - min) / span;
    // 上下各留 1px 余量，线不会被裁掉
    const y = height - 1 - ratio * (height - 2);
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });

  return `M ${points.join(' L ')}`;
}

/** 解析币安 K 线数组，取出收盘价。 */
export function extractCloses(klines: readonly unknown[][]): number[] {
  const closes: number[] = [];
  for (const kline of klines) {
    const close = Number(kline[4]);
    if (Number.isFinite(close)) closes.push(close);
  }
  return closes;
}

/** 按未实现盈亏绝对值排序，让最该关注的仓位排在前面。 */
export function sortByPnlMagnitude(
  positions: readonly NormalizedPosition[],
): NormalizedPosition[] {
  return [...positions].sort(
    (a, b) => Math.abs(b.unrealizedPnl) - Math.abs(a.unrealizedPnl),
  );
}
