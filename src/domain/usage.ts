import type { UsageModelView, UsageSnapshot, UsageView } from '@/types/usage';
import { lastNHourKeys, localHourKey } from '@/utils/time';

/** 展示近 24 小时的逐小时柱状图。 */
const HOUR_WINDOW = 24;

function safeNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

/**
 * 把采集器产出的原始快照折算成磁贴视图。
 *
 * token 口径（与 Command Code 自身一致）：`inputTokens` 已包含缓存命中，
 * 因此 total = inputTokens + outputTokens，cacheReadTokens 只是其中的子集，
 * 不可再加一次。
 */
export function buildUsageView(snapshot: UsageSnapshot, now: Date = new Date()): UsageView {
  const inputTokens = safeNumber(snapshot.totals?.inputTokens);
  const outputTokens = safeNumber(snapshot.totals?.outputTokens);
  const cacheReadTokens = safeNumber(snapshot.totals?.cacheReadTokens);
  const totalTokens = inputTokens + outputTokens;

  const byModel: UsageModelView[] = (snapshot.byModel ?? [])
    .map((row) => {
      const rowInput = safeNumber(row.inputTokens);
      const rowOutput = safeNumber(row.outputTokens);
      const rowTotal = rowInput + rowOutput;
      return {
        model: row.model,
        requests: safeNumber(row.requests),
        inputTokens: rowInput,
        outputTokens: rowOutput,
        cacheReadTokens: safeNumber(row.cacheReadTokens),
        costUsd: safeNumber(row.costUsd),
        totalTokens: rowTotal,
        ratio: totalTokens > 0 ? Number(((rowTotal / totalTokens) * 100).toFixed(1)) : 0,
      };
    })
    .sort((a, b) => b.totalTokens - a.totalTokens);

  const hourMap = new Map(
    (snapshot.byHour ?? []).map((row) => [row.hour, safeNumber(row.totalTokens)]),
  );
  const hourKeys = lastNHourKeys(HOUR_WINDOW, now);
  const hourValues = hourKeys.map((key) => hourMap.get(key) ?? 0);
  const peak = hourValues.reduce((max, value) => (value > max ? value : max), 0);
  const currentHourKey = localHourKey(now);

  const hourly = hourKeys.map((key, index) => {
    const tokens = hourValues[index] ?? 0;
    return {
      label: key.slice(11),
      requests: 0,
      tokens,
      height: peak > 0 ? Number(((tokens / peak) * 100).toFixed(1)) : 0,
      isCurrentHour: key === currentHourKey,
    };
  });

  return {
    generatedAt: snapshot.generatedAt ?? '',
    requests: safeNumber(snapshot.totals?.requests),
    totalTokens,
    freshInputTokens: Math.max(0, inputTokens - cacheReadTokens),
    outputTokens,
    cacheReadTokens,
    costUsd: safeNumber(snapshot.totals?.costUsd),
    cacheHitRate: inputTokens > 0 ? Number(((cacheReadTokens / inputTokens) * 100).toFixed(1)) : 0,
    hourly,
    hourlyTokens: hourValues.reduce((sum, value) => sum + value, 0),
    byModel,
  };
}

/** 采集器文件的形状校验：只认自己生成的结构，避免读到坏文件后整页崩掉。 */
export function isUsageSnapshot(value: unknown): value is UsageSnapshot {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<UsageSnapshot>;
  return (
    typeof candidate.generatedAt === 'string' &&
    typeof candidate.totals === 'object' &&
    candidate.totals !== null &&
    Array.isArray(candidate.byModel) &&
    Array.isArray(candidate.byDay)
  );
}
