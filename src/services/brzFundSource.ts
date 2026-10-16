import { APP_CONFIG } from '@/config/app.config';
import { buildBrzSnapshot } from '@/domain/brz';
import type {
  BrzAppSettings,
  BrzBackupEnvelope,
  BrzFundSnapshot,
  BrzSavingsGoal,
  BrzTransaction,
} from '@/types/brzFund';
import { readJson, removeKey, STORAGE_KEYS, writeJson } from './storage';

/**
 * BRZ 购车基金数据源。
 *
 * 两条路径：
 * 1. `indexeddb`：与 BRZ-Fund 同源（同为 https://cce-li.github.io 下的子路径，
 *    或本地同一端口）时直接读它的 IndexedDB，是真正的「共享同一份数据」。
 * 2. `backup`：不同源时，导入 BRZ-Fund 导出的 JSON 备份，只读快照。
 *
 * 本模块**永不写入** brz-fund 数据库 —— 仪表盘是只读镜像。
 */

export type BrzUnavailableReason = 'unsupported' | 'cannot-probe' | 'absent' | 'open-failed';

export type BrzReadOutcome =
  | { status: 'ok'; snapshot: BrzFundSnapshot }
  | { status: 'unavailable'; reason: BrzUnavailableReason; detail: string };

const REASON_TEXT: Record<BrzUnavailableReason, string> = {
  unsupported: '当前浏览器不支持 IndexedDB 探测',
  'cannot-probe':
    '无法确认 brz-fund 数据库是否存在（浏览器不支持 indexedDB.databases()）；为避免误建空库，已跳过直读',
  absent: '本机上还没有 brz-fund 数据库（先在 BRZ-Fund 应用里初始化一次）',
  'open-failed': 'brz-fund 数据库存在但无法读取',
};

type IdbFactoryWithDatabases = IDBFactory & {
  databases?: () => Promise<Array<{ name?: string; version?: number }>>;
};

/**
 * 探测数据库是否已存在。
 *
 * 关键：不能直接 `indexedDB.open('brz-fund')` 去「试一试」。无版本号打开一个
 * 不存在的库会**创建**一个空库（version=1、无任何 objectStore），随后 BRZ-Fund
 * 再打开时因为版本相同不会触发 upgrade，结果读不到任何 store —— 等于把别人的
 * 应用弄坏。所以必须先确认存在，确认不了就老实退化为导入备份。
 */
async function probeDatabaseExists(name: string): Promise<boolean | null> {
  const factory = globalThis.indexedDB as IdbFactoryWithDatabases | undefined;
  if (!factory) return null;
  if (typeof factory.databases !== 'function') return null;
  try {
    const list = await factory.databases();
    return list.some((entry) => entry.name === name);
  } catch {
    return null;
  }
}

function openExistingDatabase(name: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let request: IDBOpenDBRequest;
    try {
      // 不带版本号：不会触发 upgradeneeded，因此不会改动对方 schema
      request = globalThis.indexedDB.open(name);
    } catch (error) {
      reject(error instanceof Error ? error : new Error('indexedDB.open 失败'));
      return;
    }
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('打开数据库失败'));
    request.onblocked = () => reject(new Error('数据库被其它标签页阻塞'));
  });
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB 请求失败'));
  });
}

interface BrzRawData {
  goal: BrzSavingsGoal | null;
  transactions: BrzTransaction[];
  settings: BrzAppSettings | null;
}

async function readRawData(db: IDBDatabase): Promise<BrzRawData> {
  const storeNames = ['goals', 'transactions', 'settings'];
  const missing = storeNames.filter((name) => !db.objectStoreNames.contains(name));
  if (missing.length > 0) {
    throw new Error(`brz-fund 缺少预期的 objectStore：${missing.join(', ')}`);
  }

  const transaction = db.transaction(storeNames, 'readonly');
  const goalRequest = transaction.objectStore('goals').get(APP_CONFIG.brzFund.goalId);
  const settingsRequest = transaction.objectStore('settings').get(APP_CONFIG.brzFund.settingsId);
  const transactionsRequest = transaction.objectStore('transactions').getAll();

  const [goal, settings, transactions] = await Promise.all([
    requestToPromise(goalRequest) as Promise<BrzSavingsGoal | undefined>,
    requestToPromise(settingsRequest) as Promise<BrzAppSettings | undefined>,
    requestToPromise(transactionsRequest) as Promise<BrzTransaction[]>,
  ]);

  return {
    goal: goal ?? null,
    settings: settings ?? null,
    transactions: Array.isArray(transactions) ? transactions : [],
  };
}

/** 同源直读 BRZ-Fund 的 IndexedDB。 */
export async function readFromIndexedDb(now: Date = new Date()): Promise<BrzReadOutcome> {
  const dbName = APP_CONFIG.brzFund.dbName;
  const exists = await probeDatabaseExists(dbName);

  if (exists === null) {
    const unsupported = typeof globalThis.indexedDB === 'undefined';
    const reason: BrzUnavailableReason = unsupported ? 'unsupported' : 'cannot-probe';
    return { status: 'unavailable', reason, detail: REASON_TEXT[reason] };
  }

  if (!exists) {
    return { status: 'unavailable', reason: 'absent', detail: REASON_TEXT.absent };
  }

  let db: IDBDatabase;
  try {
    db = await openExistingDatabase(dbName);
  } catch (error) {
    return {
      status: 'unavailable',
      reason: 'open-failed',
      detail: `${REASON_TEXT['open-failed']}：${error instanceof Error ? error.message : String(error)}`,
    };
  }

  try {
    const raw = await readRawData(db);
    const snapshot = buildBrzSnapshot({ origin: 'indexeddb', ...raw, now });
    if (!snapshot) {
      return {
        status: 'unavailable',
        reason: 'absent',
        detail: 'brz-fund 里还没有购车目标（先在 BRZ-Fund 完成初始化向导）',
      };
    }
    return { status: 'ok', snapshot };
  } catch (error) {
    return {
      status: 'unavailable',
      reason: 'open-failed',
      detail: `${REASON_TEXT['open-failed']}：${error instanceof Error ? error.message : String(error)}`,
    };
  } finally {
    db.close();
  }
}

export type BrzBackupParseResult =
  | { status: 'ok'; snapshot: BrzFundSnapshot }
  | { status: 'error'; detail: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** 校验 BRZ-Fund 导出的 JSON 备份，并折算成展示快照。 */
export function parseBrzBackup(text: string, now: Date = new Date()): BrzBackupParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { status: 'error', detail: '不是合法的 JSON 文件' };
  }

  if (!isRecord(parsed)) {
    return { status: 'error', detail: '备份内容不是对象' };
  }

  const envelope = parsed as unknown as BrzBackupEnvelope;
  if (envelope.app !== APP_CONFIG.brzFund.backupAppId) {
    return {
      status: 'error',
      detail: `备份 app 标识不是 "${APP_CONFIG.brzFund.backupAppId}"，可能选错了文件`,
    };
  }
  if (!isRecord(envelope.data)) {
    return { status: 'error', detail: '备份缺少 data 字段' };
  }

  const goal = envelope.data.goal;
  if (!isRecord(goal)) {
    return { status: 'error', detail: '备份里没有购车目标（goal）' };
  }
  if (
    typeof goal.targetCarPrice !== 'number' ||
    typeof goal.purchaseExtraBudget !== 'number' ||
    typeof goal.repairBudget !== 'number'
  ) {
    return { status: 'error', detail: '购车目标的金额字段缺失或类型错误' };
  }

  const transactions = Array.isArray(envelope.data.transactions)
    ? (envelope.data.transactions as BrzTransaction[])
    : [];
  const settings = isRecord(envelope.data.settings)
    ? (envelope.data.settings as unknown as BrzAppSettings)
    : null;

  const snapshot = buildBrzSnapshot({
    origin: 'backup',
    goal: goal as unknown as BrzSavingsGoal,
    transactions,
    settings,
    now,
  });

  if (!snapshot) {
    return { status: 'error', detail: '无法从备份中推导出购车进度' };
  }

  return { status: 'ok', snapshot };
}

export interface BrzImportMeta {
  fileName: string;
  importedAt: string;
}

/** 导入的备份快照会被缓存到 localStorage，刷新页面后仍然可见。 */
export function loadCachedBackup(): { snapshot: BrzFundSnapshot | null; meta: BrzImportMeta | null } {
  return {
    snapshot: readJson<BrzFundSnapshot | null>(STORAGE_KEYS.brzBackup, null),
    meta: readJson<BrzImportMeta | null>(STORAGE_KEYS.brzBackupMeta, null),
  };
}

export function saveCachedBackup(snapshot: BrzFundSnapshot, meta: BrzImportMeta): void {
  writeJson(STORAGE_KEYS.brzBackup, snapshot);
  writeJson(STORAGE_KEYS.brzBackupMeta, meta);
}

export function clearCachedBackup(): void {
  removeKey(STORAGE_KEYS.brzBackup);
  removeKey(STORAGE_KEYS.brzBackupMeta);
}
