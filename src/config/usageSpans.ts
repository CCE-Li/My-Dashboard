/**
 * 用量条形图的时间跨度档位。滚轮在图上滚动时在这些档位之间切换，
 * 用来在"看趋势"和"看细节"之间快速往返。
 *
 * 小时档位读采集器的 byHour（只保留最近 48 小时），天档位读 byDay（全量历史）。
 */

export type UsageSpanId = '24h' | '48h' | '7d' | '14d' | '30d';

export type UsageGranularity = 'hour' | 'day';

export interface UsageSpan {
  id: UsageSpanId;
  label: string;
  granularity: UsageGranularity;
  /** 柱子数量 */
  count: number;
}

export const USAGE_SPANS: readonly UsageSpan[] = [
  { id: '24h', label: '24H', granularity: 'hour', count: 24 },
  { id: '48h', label: '48H', granularity: 'hour', count: 48 },
  { id: '7d', label: '7D', granularity: 'day', count: 7 },
  { id: '14d', label: '14D', granularity: 'day', count: 14 },
  { id: '30d', label: '30D', granularity: 'day', count: 30 },
];

export const DEFAULT_USAGE_SPAN: UsageSpanId = '24h';

export function isUsageSpanId(value: unknown): value is UsageSpanId {
  return typeof value === 'string' && USAGE_SPANS.some((span) => span.id === value);
}

/** 取档位配置；无法识别的 id 回落到默认档位。 */
export function getUsageSpan(id: string): UsageSpan {
  const matched = USAGE_SPANS.find((span) => span.id === id);
  if (matched) return matched;
  const fallback = USAGE_SPANS.find((span) => span.id === DEFAULT_USAGE_SPAN);
  if (!fallback) throw new Error('用量跨度配置为空');
  return fallback;
}

/**
 * 按方向切换到相邻档位并做边界钳制。
 * direction = 1 表示拉长跨度（看得更远），-1 表示缩短跨度（看得更细）。
 */
export function stepUsageSpan(current: string, direction: 1 | -1): UsageSpanId {
  const index = USAGE_SPANS.findIndex((span) => span.id === current);
  const safeIndex = index === -1 ? 0 : index;
  const nextIndex = Math.min(USAGE_SPANS.length - 1, Math.max(0, safeIndex + direction));
  const next = USAGE_SPANS[nextIndex];
  return next ? next.id : DEFAULT_USAGE_SPAN;
}
