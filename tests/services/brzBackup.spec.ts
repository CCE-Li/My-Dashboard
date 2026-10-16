import { describe, expect, it } from 'vitest';
import { parseBrzBackup } from '@/services/brzFundSource';

function envelope(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    app: 'brz-fund',
    schemaVersion: 1,
    exportedAt: '2026-03-01T00:00:00.000Z',
    data: {
      goal: {
        id: 'current',
        name: 'BRZ',
        targetCarPrice: 6_000_000,
        purchaseExtraBudget: 500_000,
        repairBudget: 300_000,
        currentDeadline: '2026-12-31',
        currency: 'CNY',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      transactions: [
        {
          id: 'tx-1',
          type: 'brz_transfer',
          amount: 1_000_000,
          currency: 'CNY',
          category: null,
          note: '',
          occurredAt: '2026-02-01',
          createdAt: '2026-02-01T00:00:00.000Z',
          updatedAt: '2026-02-01T00:00:00.000Z',
          opportunityId: null,
          incomeRecordId: null,
          reversalOfId: null,
          fromBucket: null,
          toBucket: 'brz',
          voidedAt: null,
        },
      ],
      settings: {
        id: 'app',
        currency: 'CNY',
        locale: 'zh-CN',
        emergencyTarget: 1_000_000,
        plannedMonthlySaving: null,
      },
    },
    ...overrides,
  });
}

describe('parseBrzBackup', () => {
  const now = new Date(2026, 2, 1);

  it('解析合法备份并算出余额', () => {
    const result = parseBrzBackup(envelope(), now);
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.snapshot.origin).toBe('backup');
    expect(result.snapshot.fundBalance).toBe(1_000_000);
    expect(result.snapshot.targetTotal).toBe(6_800_000);
    expect(result.snapshot.progressPercent).toBe(14.7);
  });

  it('拒绝非 JSON', () => {
    const result = parseBrzBackup('not json', now);
    expect(result).toMatchObject({ status: 'error' });
  });

  it('拒绝别的应用的备份', () => {
    const result = parseBrzBackup(envelope({ app: 'other-app' }), now);
    expect(result.status).toBe('error');
    if (result.status !== 'error') return;
    expect(result.detail).toContain('brz-fund');
  });

  it('拒绝缺少购车目标的备份', () => {
    const result = parseBrzBackup(
      JSON.stringify({ app: 'brz-fund', schemaVersion: 1, data: { transactions: [] } }),
      now,
    );
    expect(result.status).toBe('error');
  });

  it('拒绝金额字段类型错误的备份', () => {
    const broken = JSON.parse(envelope());
    broken.data.goal.targetCarPrice = '6000000';
    const result = parseBrzBackup(JSON.stringify(broken), now);
    expect(result.status).toBe('error');
  });

  it('没有交易记录时按零余额处理，而不是报错', () => {
    const withoutTransactions = JSON.parse(envelope());
    delete withoutTransactions.data.transactions;
    const result = parseBrzBackup(JSON.stringify(withoutTransactions), now);
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.snapshot.fundBalance).toBe(0);
  });
});
