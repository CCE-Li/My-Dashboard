import { getUsageSpan, type UsageSpan, type UsageSpanId } from '@/config/usageSpans';
import type {
  QuotaBar,
  QuotaConfig,
  UsageBar,
  UsageModelView,
  UsageSnapshot,
  UsageView,
} from '@/types/usage';
import { lastNDayKeys, lastNHourKeys, localDayKey, localHourKey } from '@/utils/time';

function safeNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

/**
 * 把采集器产出的原始快照折算成磁贴视图。
 *
 * token 口径（与 Command Code 自身一致）：`inputTokens` 已包含缓存命中，
 * 因此 total = inputTokens + outputTokens，cacheReadTokens 只是其中的子集，
 * 不可再加一次。
 *
 * 时间跨度：小时档位用 byHour（采集器只保留最近 48 小时），
 * 天档位用 byDay（全量历史），两边都补齐零值刻度以保证时间轴连续。
 */
export function buildUsageView(
  snapshot: UsageSnapshot,
  span: UsageSpan | UsageSpanId = '24h',
  now: Date = new Date(),
): UsageView {
  const resolvedSpan = typeof span === 'string' ? getUsageSpan(span) : span;

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
  const dayMap = new Map((snapshot.byDay ?? []).map((row) => [row.day, safeNumber(row.totalTokens)]));

  const useHours = resolvedSpan.granularity === 'hour';
  const keys = useHours
    ? lastNHourKeys(resolvedSpan.count, now)
    : lastNDayKeys(resolvedSpan.count, now);
  const lookup = useHours ? hourMap : dayMap;
  const currentKey = useHours ? localHourKey(now) : localDayKey(now);

  const tokensPerKey = keys.map((key) => lookup.get(key) ?? 0);
  const peak = tokensPerKey.reduce((max, value) => (value > max ? value : max), 0);

  const bars: UsageBar[] = keys.map((key, index) => {
    const tokens = tokensPerKey[index] ?? 0;
    return {
      label: useHours ? key.slice(11) : key.slice(5),
      requests: 0,
      tokens,
      height: peak > 0 ? Number(((tokens / peak) * 100).toFixed(1)) : 0,
      isCurrent: key === currentKey,
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
    span: resolvedSpan.id,
    spanLabel: resolvedSpan.label,
    bars,
    windowTokens: tokensPerKey.reduce((sum, value) => sum + value, 0),
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

/** 最近 N 个小时桶内的 token 合计。byHour 只覆盖最近 48 小时，超出范围计 0。 */
export function sumTokensWithinHours(
  snapshot: UsageSnapshot,
  hours: number,
  now: Date = new Date(),
): number {
  const keys = new Set(lastNHourKeys(hours, now));
  let sum = 0;
  for (const row of snapshot.byHour ?? []) {
    if (keys.has(row.hour)) sum += safeNumber(row.totalTokens);
  }
  return sum;
}

export const EMPTY_QUOTA: QuotaConfig = { tokens5h: 0, tokens24h: 0, creditUsd: 0 };

function normalizeQuotaNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;
}

/** 把 localStorage 里读到的脏数据收敛成合法配额，绝不因为手改过的值而崩掉。 */
export function normalizeQuotaConfig(value: unknown): QuotaConfig {
  if (typeof value !== 'object' || value === null) return { ...EMPTY_QUOTA };
  const record = value as Record<string, unknown>;
  return {
    tokens5h: normalizeQuotaNumber(record['tokens5h']),
    tokens24h: normalizeQuotaNumber(record['tokens24h']),
    creditUsd: normalizeQuotaNumber(record['creditUsd']),
  };
}

/**
 * 组装配额进度条。
 *
 * 分子是真实用量（5h / 24h 滚动窗口的 token、以及全量累计费用），
 * 分母是用户自己配置的配额。配额没填时 configured 为 false，
 * 界面应展示「未设配额」而不是画一条假的进度。
 */
export function buildQuotaBars(
  snapshot: UsageSnapshot,
  quota: QuotaConfig,
  now: Date = new Date(),
): QuotaBar[] {
  const definitions = [
    {
      id: '5h' as const,
      label: '5H',
      used: sumTokensWithinHours(snapshot, 5, now),
      quota: quota.tokens5h,
      unit: 'tokens' as const,
    },
    {
      id: '24h' as const,
      label: '24H',
      used: sumTokensWithinHours(snapshot, 24, now),
      quota: quota.tokens24h,
      unit: 'tokens' as const,
    },
    {
      id: 'credit' as const,
      label: '总额度',
      used: safeNumber(snapshot.totals?.costUsd),
      quota: quota.creditUsd,
      unit: 'usd' as const,
    },
  ];

  return definitions.map((definition) => {
    const configured = definition.quota > 0;
    const rawPercent = configured ? (definition.used / definition.quota) * 100 : 0;
    return {
      ...definition,
      configured,
      percent: Math.max(0, Math.min(100, Number(rawPercent.toFixed(1)))),
    };
  });
}
