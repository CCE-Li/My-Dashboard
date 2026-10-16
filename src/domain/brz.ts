import type {
  BrzAppSettings,
  BrzFundSnapshot,
  BrzSavingsGoal,
  BrzTransaction,
  Bucket,
  Cents,
} from '@/types/brzFund';
import { daysUntil, localDayKey } from '@/utils/time';

/**
 * 本文件是 `BRZ-Fund/src/domain/balances.ts` 的只读移植：
 * 仪表盘不写任何 BRZ 数据，只按同一套规则读取并派生展示指标。
 * 改动这里之前，先确认 BRZ-Fund 侧是否也改了 —— 两边必须保持同口径，
 * 否则磁贴上的余额会与 BRZ-Fund 内部对不上。
 */

export const BUCKETS: readonly Bucket[] = ['unallocated', 'brz', 'emergency', 'other'];

export type BucketBalances = Record<Bucket, Cents>;

export const EMPTY_BUCKET_BALANCES: BucketBalances = {
  unallocated: 0,
  brz: 0,
  emergency: 0,
  other: 0,
};

function normalizeCents(value: number): Cents {
  return Number.isFinite(value) ? Math.round(value) : 0;
}

/**
 * 单笔交易对资金桶的净影响。全部余额计算的唯一入口：
 * 收入计入目标桶；支出从来源桶扣除；修正型调整按 from/to 桶移动；
 * 转账与支出在同一聚合器中处理，因此「桶间移动」永不会被当作新增收入。
 */
export function transactionBucketDelta(transaction: BrzTransaction): BucketBalances {
  const delta: BucketBalances = { ...EMPTY_BUCKET_BALANCES };
  if (transaction.voidedAt) return delta;

  const amount = normalizeCents(transaction.amount);
  if (amount === 0) return delta;

  switch (transaction.type) {
    case 'income':
      delta[transaction.toBucket] += amount;
      break;
    case 'expense':
      delta[transaction.fromBucket ?? 'unallocated'] -= amount;
      break;
    case 'brz_withdraw':
    case 'emergency_withdraw':
      delta[transaction.fromBucket ?? 'unallocated'] -= amount;
      delta[transaction.toBucket] += amount;
      break;
    case 'brz_transfer':
      delta.unallocated -= amount;
      delta.brz += amount;
      break;
    case 'emergency_transfer':
      delta.unallocated -= amount;
      delta.emergency += amount;
      break;
    case 'transfer': {
      const from = transaction.fromBucket ?? 'unallocated';
      const to = transaction.toBucket;
      if (from === to) break;
      delta[from] -= amount;
      delta[to] += amount;
      break;
    }
    case 'adjustment': {
      const from = transaction.fromBucket;
      const to = transaction.toBucket;
      if (from) delta[from] -= amount;
      if (to) delta[to] += amount;
      break;
    }
    default:
      break;
  }

  return delta;
}

/** 当前各资金桶余额（不含已作废交易）。 */
export function calculateBucketBalances(transactions: readonly BrzTransaction[]): BucketBalances {
  const balances: BucketBalances = { ...EMPTY_BUCKET_BALANCES };
  for (const transaction of transactions) {
    const delta = transactionBucketDelta(transaction);
    for (const bucket of BUCKETS) {
      balances[bucket] += delta[bucket];
    }
  }
  return balances;
}

/** 目标总额 = 裸车 + 附加费用 + 整备维修（应急金独立计算）。 */
export function goalTargetTotal(
  goal: Pick<BrzSavingsGoal, 'targetCarPrice' | 'purchaseExtraBudget' | 'repairBudget'>,
): Cents {
  return (
    normalizeCents(goal.targetCarPrice) +
    normalizeCents(goal.purchaseExtraBudget) +
    normalizeCents(goal.repairBudget)
  );
}

/** 本月（自然月）净流入购车基金桶的金额，转账与调整按净额计入。 */
export function calculateMonthlyInflow(
  transactions: readonly BrzTransaction[],
  now: Date = new Date(),
): Cents {
  const monthStart = `${localDayKey(now).slice(0, 7)}-01`;
  let inflow = 0;
  for (const transaction of transactions) {
    if (transaction.occurredAt < monthStart) continue;
    inflow += transactionBucketDelta(transaction).brz;
  }
  return inflow;
}

export interface BuildBrzSnapshotInput {
  origin: BrzFundSnapshot['origin'];
  goal: BrzSavingsGoal | null;
  transactions: readonly BrzTransaction[];
  settings: BrzAppSettings | null;
  now?: Date;
}

/**
 * 把 BRZ-Fund 的原始实体折算成磁贴要展示的一组指标。
 * 没有 goal 时返回 null —— 调用方负责展示「未接入」空状态。
 */
export function buildBrzSnapshot(input: BuildBrzSnapshotInput): BrzFundSnapshot | null {
  const { goal, settings, transactions, origin } = input;
  if (!goal) return null;

  const now = input.now ?? new Date();
  const balances = calculateBucketBalances(transactions);
  const targetTotal = goalTargetTotal(goal);
  const fundBalance = balances.brz;
  const rawPercent = targetTotal > 0 ? (fundBalance / targetTotal) * 100 : 0;

  return {
    origin,
    currency: goal.currency || settings?.currency || 'CNY',
    goalName: goal.name || '购车基金',
    fundBalance,
    targetTotal,
    gap: Math.max(0, targetTotal - fundBalance),
    progressPercent: Math.max(0, Math.min(100, Number(rawPercent.toFixed(1)))),
    emergencyBalance: balances.emergency,
    emergencyTarget: normalizeCents(settings?.emergencyTarget ?? 0),
    unallocatedBalance: balances.unallocated,
    monthlyInflow: calculateMonthlyInflow(transactions, now),
    deadline: goal.currentDeadline || null,
    daysToDeadline: goal.currentDeadline ? daysUntil(goal.currentDeadline, now) : null,
    capturedAt: now.toISOString(),
    updatedAt: goal.updatedAt ?? null,
  };
}
