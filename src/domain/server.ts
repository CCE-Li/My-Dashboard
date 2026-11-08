import type { RawServerMetrics, ServerDisk, ServerView } from '@/types/server';

/**
 * 服务器指标的纯计算层：归一化、占用率、格式化、告警档位。
 * 不碰网络、不碰 DOM，便于单测。
 */

const GIB = 1024 ** 3;

function toNumber(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** 占用率（%），并夹到 0–100。分母 <= 0 时返回 0，避免除零。 */
export function usagePercent(used: number, total: number): number {
  const safeUsed = toNumber(used);
  const safeTotal = toNumber(total);
  if (safeTotal <= 0) return 0;
  return Math.max(0, Math.min(100, (safeUsed / safeTotal) * 100));
}

/** 字节 → GiB（数值，供进一步计算） */
export function bytesToGib(bytes: number): number {
  return toNumber(bytes) / GIB;
}

/** 字节 → 人类可读容量，>1024 GiB 时改用 TiB。 */
export function formatBytes(bytes: number): string {
  const gib = bytesToGib(bytes);
  if (gib >= 1024) return `${(gib / 1024).toFixed(2)} TiB`;
  return `${gib.toFixed(1)} GiB`;
}

/** 秒 → 人类可读运行时长 */
export function formatUptime(seconds: number): string {
  const total = Math.max(0, Math.floor(toNumber(seconds)));
  const days = Math.floor(total / 86_400);
  const hours = Math.floor((total % 86_400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (days > 0) return `${days} 天 ${hours} 小时`;
  if (hours > 0) return `${hours} 小时 ${minutes} 分`;
  return `${minutes} 分`;
}

export type Severity = 'ok' | 'warn' | 'critical';

/** 占用率告警档位：>=90 严重，>=80 警告 —— 与配额进度条同一口径。 */
export function severityOf(percent: number): Severity {
  const safe = toNumber(percent);
  if (safe >= 90) return 'critical';
  if (safe >= 80) return 'warn';
  return 'ok';
}

function normalizeDisk(
  raw: { mount?: string; totalBytes?: number; usedBytes?: number },
  index: number,
): ServerDisk {
  const totalBytes = toNumber(raw.totalBytes);
  const usedBytes = toNumber(raw.usedBytes);
  const mount = raw.mount?.trim();
  return {
    mount: mount ? mount : `disk${index + 1}`,
    totalBytes,
    usedBytes,
    percent: usagePercent(usedBytes, totalBytes),
  };
}

/** 选主磁盘：优先挂载点 /，否则取第一个。 */
export function pickPrimaryDisk(disks: readonly ServerDisk[]): ServerDisk | null {
  if (disks.length === 0) return null;
  return disks.find((disk) => disk.mount === '/') ?? disks[0] ?? null;
}

/** 把端点的原始返回归一化成视图模型。缺失字段一律按 0/空处理。 */
export function normalizeServerMetrics(raw: RawServerMetrics): ServerView {
  const memoryTotalBytes = toNumber(raw.memory?.totalBytes);
  const memoryUsedBytes = toNumber(raw.memory?.usedBytes);
  const disks = (raw.disks ?? []).map(normalizeDisk);

  return {
    hostname: raw.hostname?.trim() || 'unknown',
    platform: raw.platform?.trim() || 'unknown',
    uptimeSec: toNumber(raw.uptimeSec),
    loadAvg: (raw.loadAvg ?? []).map(toNumber).slice(0, 3),
    cpuPercent: Math.max(0, Math.min(100, toNumber(raw.cpu?.usagePercent))),
    cores: toNumber(raw.cpu?.cores),
    memoryTotalBytes,
    memoryUsedBytes,
    memoryPercent: usagePercent(memoryUsedBytes, memoryTotalBytes),
    disk: pickPrimaryDisk(disks),
    generatedAt: typeof raw.generatedAt === 'string' ? raw.generatedAt : null,
  };
}
