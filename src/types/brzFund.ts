/**
 * BRZ-Fund 领域模型的「只读镜像」。字段与
 * `BRZ-Fund/src/types/models.ts` 一一对应，本仓库不写入这些数据，
 * 因此只镜像读取所需的部分（新增字段不会影响这里）。
 *
 * 金额一律为「整数分」；业务日期为 YYYY-MM-DD。
 */

export type Cents = number;
export type DateString = string; // YYYY-MM-DD
export type ISODateTimeString = string;

export type Bucket = 'unallocated' | 'brz' | 'emergency' | 'other';

export type TransactionType =
  | 'income'
  | 'expense'
  | 'transfer'
  | 'brz_transfer'
  | 'brz_withdraw'
  | 'emergency_transfer'
  | 'emergency_withdraw'
  | 'adjustment';

export interface BrzTransaction {
  id: string;
  type: TransactionType;
  /** 恒为非负数（分）；方向由 type 与 fromBucket/toBucket 表达。 */
  amount: Cents;
  currency: string;
  category: string | null;
  note: string;
  occurredAt: DateString;
  createdAt: ISODateTimeString;
  updatedAt: ISODateTimeString;
  opportunityId: string | null;
  incomeRecordId: string | null;
  reversalOfId: string | null;
  fromBucket: Bucket | null;
  toBucket: Bucket;
  /** 软作废时间；非空记录不参与任何计算。 */
  voidedAt: ISODateTimeString | null;
}

export interface BrzSavingsGoal {
  id: 'current' | string;
  name: string;
  /** 裸车目标价格（分） */
  targetCarPrice: Cents;
  /** 购车附加费用预算（分） */
  purchaseExtraBudget: Cents;
  /** 初期整备及维修预算（分） */
  repairBudget: Cents;
  /** 计划购车日期 YYYY-MM-DD */
  currentDeadline: DateString;
  currency: string;
  createdAt: ISODateTimeString;
  updatedAt: ISODateTimeString;
}

export interface BrzAppSettings {
  id: 'app' | string;
  currency: string;
  locale: string;
  /** 应急储备目标（分） */
  emergencyTarget: Cents;
  plannedMonthlySaving: Cents | null;
}

/** BRZ-Fund 导出的 JSON 备份信封（settingsService/backupService 的口径）。 */
export interface BrzBackupEnvelope {
  app: string;
  schemaVersion: number;
  exportedAt: ISODateTimeString;
  data: {
    goal?: BrzSavingsGoal | null;
    transactions?: BrzTransaction[];
    settings?: BrzAppSettings | null;
    [key: string]: unknown;
  };
}

export interface BrzFundSnapshot {
  origin: 'indexeddb' | 'backup';
  currency: string;
  goalName: string;
  /** 购车基金桶余额（分） */
  fundBalance: Cents;
  /** 目标总额 = 裸车 + 附加费用 + 整备（分） */
  targetTotal: Cents;
  /** 缺口，已达成时为 0（分） */
  gap: Cents;
  /** 完成度百分比，0–100，保留一位小数 */
  progressPercent: number;
  emergencyBalance: Cents;
  emergencyTarget: Cents;
  unallocatedBalance: Cents;
  /** 本月净流入购车基金（分） */
  monthlyInflow: Cents;
  deadline: DateString | null;
  /** 距截止日的自然日差；过期或未设置时为 null */
  daysToDeadline: number | null;
  /** 数据快照时间（ISO） */
  capturedAt: ISODateTimeString;
  updatedAt: ISODateTimeString | null;
}
