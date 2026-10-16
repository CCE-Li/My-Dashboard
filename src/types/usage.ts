import type { UsageSpanId } from '@/config/usageSpans';

/**
 * Command Code 用量快照。由 `scripts/sync-commandcode-usage.mjs` 扫描
 * `~/.commandcode/projects/<project>/<session>.jsonl` 生成，
 * 落到 `public/data/command-code-usage.json`。
 * 口径与 Command Code 自身一致：
 * - `inputTokens` 是「含缓存命中」的总输入；fresh 输入 = inputTokens - cacheReadTokens
 * - `costUsd` 是 Command Code 权威计价，不由本地价目表重算
 */

export interface UsageModelRow {
  model: string;
  requests: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  costUsd: number;
}

export interface UsageDayRow {
  /** 本地日历日 YYYY-MM-DD */
  day: string;
  requests: number;
  totalTokens: number;
  costUsd: number;
}

/** 小时聚合（本地时区，键为 YYYY-MM-DDTHH）；采集器只保留最近 48 小时。 */
export interface UsageHourRow {
  hour: string;
  requests: number;
  totalTokens: number;
  costUsd: number;
}

export interface UsageSnapshot {
  generatedAt: string;
  /** 扫描根目录（仅用于展示与排查） */
  source: string;
  sessionFiles: number;
  totals: {
    requests: number;
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    costUsd: number;
  };
  byModel: UsageModelRow[];
  byDay: UsageDayRow[];
  byHour: UsageHourRow[];
}

export interface UsageModelView extends UsageModelRow {
  totalTokens: number;
  /** 占总 token 的比例，0–100 */
  ratio: number;
}

export interface UsageBar {
  /** 刻度标签：小时档位是 "14"，天档位是 "10-16" */
  label: string;
  requests: number;
  tokens: number;
  /** 柱高百分比（0–100），相对窗口内峰值 */
  height: number;
  isCurrent: boolean;
}

/**
 * 配额（进度条的分母）。只能由用户自己填：
 * 官方没有查询额度的接口，本机会话文件里也只有用量、没有额度。
 */
export interface QuotaConfig {
  /** 5 小时滚动窗口的 token 配额；0 = 未配置 */
  tokens5h: number;
  /** 24 小时滚动窗口的 token 配额；0 = 未配置 */
  tokens24h: number;
  /** 总充值额度（美元）；0 = 未配置 */
  creditUsd: number;
}

export type QuotaBarId = '5h' | '24h' | 'credit';

export interface QuotaBar {
  id: QuotaBarId;
  label: string;
  /** 已用量：token 窗口是 token 数，总额度是美元 */
  used: number;
  /** 配额，0 表示未配置 */
  quota: number;
  /** 已用百分比（0–100，超额封顶 100）；未配置时为 0 */
  percent: number;
  configured: boolean;
  /** 该条展示的单位，决定数字怎么格式化 */
  unit: 'tokens' | 'usd';
}

export interface UsageView {
  generatedAt: string;
  requests: number;
  totalTokens: number;
  freshInputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  costUsd: number;
  cacheHitRate: number;
  /** 当前时间跨度档位 id 与展示标签 */
  span: UsageSpanId;
  spanLabel: string;
  /** 连续时间轴上的柱子（含零值刻度，保证时间轴不断档） */
  bars: UsageBar[];
  /** 当前窗口内的 token 合计 */
  windowTokens: number;
  byModel: UsageModelView[];
}
