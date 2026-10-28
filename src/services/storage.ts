/** localStorage 的统一封装：命名空间 + 版本前缀 + 永不抛错。 */

const NAMESPACE = 'mydash:v1:';

function key(name: string): string {
  return `${NAMESPACE}${name}`;
}

export function readJson<T>(name: string, fallback: T): T {
  try {
    const raw = globalThis.localStorage?.getItem(key(name));
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    // 隐私模式 / 配额异常 / 脏数据：一律退回默认值，不阻断渲染
    return fallback;
  }
}

export function writeJson(name: string, value: unknown): boolean {
  try {
    globalThis.localStorage?.setItem(key(name), JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function removeKey(name: string): void {
  try {
    globalThis.localStorage?.removeItem(key(name));
  } catch {
    // 忽略：清理失败不影响功能
  }
}

export function readText(name: string, fallback: string): string {
  try {
    return globalThis.localStorage?.getItem(key(name)) ?? fallback;
  } catch {
    return fallback;
  }
}

export function writeText(name: string, value: string): boolean {
  try {
    globalThis.localStorage?.setItem(key(name), value);
    return true;
  } catch {
    return false;
  }
}

export const STORAGE_KEYS = {
  tileOrder: 'tile-order',
  codeforcesHandle: 'codeforces-handle',
  codeforcesCache: 'codeforces-cache',
  brzBackup: 'brz-backup-snapshot',
  brzBackupMeta: 'brz-backup-meta',
  commandCodeApiKey: 'command-code-api-key',
  searchPlatform: 'search-platform',
  usageSpan: 'usage-span',
  quotaConfig: 'quota-config',
  theme: 'theme',
  binanceApiKey: 'binance-api-key',
  binanceApiSecret: 'binance-api-secret',
  binanceWatchlist: 'binance-watchlist',
  binanceApiBase: 'binance-api-base',
} as const;
