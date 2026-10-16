import { describe, expect, it } from 'vitest';
import {
  buildBrzSnapshot,
  calculateBucketBalances,
  calculateMonthlyInflow,
  goalTargetTotal,
  transactionBucketDelta,
} from '@/domain/brz';
import type { BrzSavingsGoal, BrzTransaction, Bucket, TransactionType } from '@/types/brzFund';

let sequence = 0;

function tx(partial: {
  type: TransactionType;
  amount: number;
  occurredAt?: string;
  toBucket?: Bucket;
  fromBucket?: Bucket | null;
  voidedAt?: string | null;
}): BrzTransaction {
  sequence += 1;
  return {
    id: `tx-${sequence}`,
    type: partial.type,
    amount: partial.amount,
    currency: 'CNY',
    category: null,
    note: '',
    occurredAt: partial.occurredAt ?? '2026-01-15',
    createdAt: '2026-01-15T00:00:00.000Z',
    updatedAt: '2026-01-15T00:00:00.000Z',
    opportunityId: null,
    incomeRecordId: null,
    reversalOfId: null,
    fromBucket: partial.fromBucket ?? null,
    toBucket: partial.toBucket ?? 'unallocated',
    voidedAt: partial.voidedAt ?? null,
  };
}

function goal(partial: Partial<BrzSavingsGoal> = {}): BrzSavingsGoal {
  return {
    id: 'current',
    name: 'BRZ',
    targetCarPrice: 6_000_000,
    purchaseExtraBudget: 500_000,
    repairBudget: 300_000,
    currentDeadline: '2026-12-31',
    currency: 'CNY',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...partial,
  };
}

describe('transactionBucketDelta', () => {
  it('收入计入 toBucket', () => {
    const delta = transactionBucketDelta(tx({ type: 'income', amount: 1000, toBucket: 'brz' }));
    expect(delta.brz).toBe(1000);
    expect(delta.unallocated).toBe(0);
  });

  it('支出从 fromBucket 扣除，缺省为未分配', () => {
    expect(transactionBucketDelta(tx({ type: 'expense', amount: 300 })).unallocated).toBe(-300);
    expect(
      transactionBucketDelta(
        tx({ type: 'expense', amount: 300, fromBucket: 'brz', toBucket: 'unallocated' }),
      ).brz,
    ).toBe(-300);
  });

  it('brz_transfer 只在桶间移动，总收入不变', () => {
    const transactions = [
      tx({ type: 'income', amount: 5000, toBucket: 'unallocated' }),
      tx({ type: 'brz_transfer', amount: 2000, toBucket: 'brz' }),
    ];
    const balances = calculateBucketBalances(transactions);
    expect(balances.brz).toBe(2000);
    expect(balances.unallocated).toBe(3000);
    // 转账不是新收入：四桶合计仍等于最初那一笔收入
    expect(balances.unallocated + balances.brz + balances.emergency + balances.other).toBe(5000);
  });

  it('transfer 同桶移动时不产生任何变化', () => {
    const delta = transactionBucketDelta(
      tx({ type: 'transfer', amount: 500, fromBucket: 'brz', toBucket: 'brz' }),
    );
    expect(delta).toEqual({ unallocated: 0, brz: 0, emergency: 0, other: 0 });
  });

  it('adjustment 支持只进不出（期初修正）', () => {
    const delta = transactionBucketDelta(
      tx({ type: 'adjustment', amount: 1200, fromBucket: null, toBucket: 'brz' }),
    );
    expect(delta.brz).toBe(1200);
    expect(delta.unallocated).toBe(0);
  });

  it('已作废交易不参与任何计算', () => {
    const delta = transactionBucketDelta(
      tx({ type: 'income', amount: 9999, toBucket: 'brz', voidedAt: '2026-02-01T00:00:00.000Z' }),
    );
    expect(delta.brz).toBe(0);
  });

  it('金额非有限数时按 0 处理', () => {
    const delta = transactionBucketDelta(tx({ type: 'income', amount: Number.NaN, toBucket: 'brz' }));
    expect(delta.brz).toBe(0);
  });
});

describe('goalTargetTotal', () => {
  it('等于裸车 + 附加费用 + 整备预算', () => {
    expect(goalTargetTotal(goal())).toBe(6_800_000);
  });
});

describe('calculateMonthlyInflow', () => {
  it('只统计本月内进入购车基金桶的净额', () => {
    const transactions = [
      tx({ type: 'brz_transfer', amount: 10_000, occurredAt: '2026-03-05' }),
      tx({ type: 'brz_transfer', amount: 4_000, occurredAt: '2026-03-20' }),
      tx({ type: 'brz_withdraw', amount: 2_500, occurredAt: '2026-03-21', fromBucket: 'brz', toBucket: 'unallocated' }),
      tx({ type: 'brz_transfer', amount: 99_999, occurredAt: '2026-02-28' }),
    ];
    expect(calculateMonthlyInflow(transactions, new Date(2026, 2, 25))).toBe(11_500);
  });
});

describe('buildBrzSnapshot', () => {
  it('没有目标时返回 null（由 UI 展示未接入状态）', () => {
    expect(buildBrzSnapshot({ origin: 'indexeddb', goal: null, transactions: [], settings: null }))
      .toBeNull();
  });

  it('零余额起步：进度 0、缺口等于目标总额', () => {
    const snapshot = buildBrzSnapshot({
      origin: 'indexeddb',
      goal: goal(),
      transactions: [],
      settings: null,
      now: new Date(2026, 5, 1),
    });
    expect(snapshot?.fundBalance).toBe(0);
    expect(snapshot?.progressPercent).toBe(0);
    expect(snapshot?.gap).toBe(6_800_000);
  });

  it('部分资金：进度按百分比保留一位小数', () => {
    const snapshot = buildBrzSnapshot({
      origin: 'indexeddb',
      goal: goal(),
      transactions: [
        tx({ type: 'income', amount: 2_480_000, toBucket: 'unallocated' }),
        tx({ type: 'brz_transfer', amount: 2_480_000 }),
      ],
      settings: null,
      now: new Date(2026, 5, 1),
    });
    expect(snapshot?.fundBalance).toBe(2_480_000);
    expect(snapshot?.progressPercent).toBe(36.5);
  });

  it('超额存入时进度封顶 100、缺口归零', () => {
    const snapshot = buildBrzSnapshot({
      origin: 'backup',
      goal: goal(),
      transactions: [tx({ type: 'adjustment', amount: 9_000_000, toBucket: 'brz' })],
      settings: null,
      now: new Date(2026, 5, 1),
    });
    expect(snapshot?.progressPercent).toBe(100);
    expect(snapshot?.gap).toBe(0);
  });

  it('应急储备与未分配现金分开统计', () => {
    const snapshot = buildBrzSnapshot({
      origin: 'indexeddb',
      goal: goal(),
      transactions: [
        tx({ type: 'income', amount: 5_000_000, toBucket: 'unallocated' }),
        tx({ type: 'brz_transfer', amount: 1_000_000 }),
        tx({ type: 'emergency_transfer', amount: 400_000 }),
      ],
      settings: {
        id: 'app',
        currency: 'CNY',
        locale: 'zh-CN',
        emergencyTarget: 1_000_000,
        plannedMonthlySaving: null,
      },
      now: new Date(2026, 5, 1),
    });
    expect(snapshot?.fundBalance).toBe(1_000_000);
    expect(snapshot?.emergencyBalance).toBe(400_000);
    expect(snapshot?.emergencyTarget).toBe(1_000_000);
    expect(snapshot?.unallocatedBalance).toBe(3_600_000);
  });

  it('截止日倒计时按本地日历日计算', () => {
    const snapshot = buildBrzSnapshot({
      origin: 'indexeddb',
      goal: goal({ currentDeadline: '2026-06-11' }),
      transactions: [],
      settings: null,
      now: new Date(2026, 5, 1),
    });
    expect(snapshot?.daysToDeadline).toBe(10);
  });

  it('截止日已过返回负数', () => {
    const snapshot = buildBrzSnapshot({
      origin: 'indexeddb',
      goal: goal({ currentDeadline: '2026-05-30' }),
      transactions: [],
      settings: null,
      now: new Date(2026, 5, 1),
    });
    expect(snapshot?.daysToDeadline).toBe(-2);
  });
});
