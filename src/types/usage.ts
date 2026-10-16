/**
 * Command Code 用量快照。由 `scripts/sync-commandcode-usage.mjs` 扫描
 * `~/.commandcode/projects/<project>/<session>.jsonl` 生成，
 * 落到 `public/data/command-code-usage.json`。
 *
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

export interface UsageHourBar {
  /** 展示用小时标签，如 "14" */
  label: string;
  requests: number;
  tokens: number;
  /** 柱高百分比（0–100），相对窗口内峰值 */
  height: number;
  isCurrentHour: boolean;
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
  /** 近 24 小时逐小时柱（含零值小时，保证时间轴连续） */
  hourly: UsageHourBar[];
  hourlyTokens: number;
  byModel: UsageModelView[];
}
