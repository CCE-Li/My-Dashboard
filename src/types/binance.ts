/** 币安 U 本位合约（fapi）相关的原始与派生类型。 */

/** `/fapi/v2|v3/positionRisk` 的原始返回项。数值字段都是字符串。 */
export interface RawPositionRisk {
  symbol: string;
  positionAmt: string;
  entryPrice: string;
  /** `/fapi/v2/account` 的 positions 里没有这个字段，只有 positionRisk 才有 */
  markPrice?: string;
  /**
   * 未实现盈亏。币安文档在不同版本里拼写不一致（unRealizedProfit / unrealizedProfit），
   * 两个都声明为可选，解析时取存在的那个。
   */
  unRealizedProfit?: string;
  unrealizedProfit?: string;
  liquidationPrice: string;
  leverage: string;
  marginType: string;
  positionSide: string;
  notional: string;
  isolatedWallet?: string;
}

/** `/fapi/v1/ticker/24hr` 的原始返回项（只取用得到的字段）。 */
export interface RawTicker24h {
  symbol: string;
  lastPrice: string;
  priceChangePercent: string;
  quoteVolume: string;
}

/** K 线数组：币安返回的是混合类型的数组，这里只关心收盘价与时间。 */
export type RawKline = [number, string, string, string, string, ...unknown[]];

export type PositionSide = 'LONG' | 'SHORT';

export interface NormalizedPosition {
  symbol: string;
  /** 业务方向：positionAmt 正为多头，负为空头 */
  side: PositionSide;
  /** 仓位数量绝对值 */
  amount: number;
  entryPrice: number;
  markPrice: number;
  unrealizedPnl: number;
  /** 未实现盈亏 / 仓位名义价值 × 杠杆，即 ROE 百分比 */
  roePercent: number;
  notional: number;
  leverage: number;
}

export interface PositionSummary {
  totalPnl: number;
  longCount: number;
  shortCount: number;
  winnerCount: number;
  loserCount: number;
}

export interface WatchQuote {
  symbol: string;
  lastPrice: number;
  changePercent: number;
  quoteVolume: number;
  /** 收盘价序列，用于画迷你走势 */
  closes: number[];
}

export interface BinanceSyncMeta {
  /** 数据抓取时间（毫秒时间戳） */
  fetchedAt: number;
  /** 与币安服务器的时间偏差（毫秒），用于签名 */
  timeOffsetMs: number;
}
