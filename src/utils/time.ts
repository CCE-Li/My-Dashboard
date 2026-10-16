function pad2(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

/** 本地日历日 YYYY-MM-DD（与 BRZ-Fund 的 DateString 口径一致）。 */
export function localDayKey(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/** 本地月份 YYYY-MM。 */
export function localMonthKey(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`;
}

/** 本地小时 YYYY-MM-DDTHH。 */
export function localHourKey(date: Date): string {
  return `${localDayKey(date)}T${pad2(date.getHours())}`;
}

/** 从 dayKey 解析出本地时区的当天零点。 */
export function parseDayKey(day: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const date = Number(match[3]);
  const parsed = new Date(year, month - 1, date);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * 距目标日期的自然日差（按本地零点计算）。
 * 已过期返回负数，非法输入返回 null。
 */
export function daysUntil(day: string, now: Date = new Date()): number | null {
  const target = parseDayKey(day);
  if (!target) return null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

/** 最近的 n 个本地日历日，从旧到新，末位为今天。 */
export function lastNDayKeys(n: number, now: Date = new Date()): string[] {
  const keys: string[] = [];
  for (let offset = n - 1; offset >= 0; offset -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset);
    keys.push(localDayKey(date));
  }
  return keys;
}

/** 最近的 n 个本地小时，从旧到新，末位为当前小时。 */
export function lastNHourKeys(n: number, now: Date = new Date()): string[] {
  const keys: string[] = [];
  for (let offset = n - 1; offset >= 0; offset -= 1) {
    const date = new Date(now.getTime() - offset * 3_600_000);
    keys.push(localHourKey(date));
  }
  return keys;
}

/** 顶部状态栏时钟：HH:MM:SS UTC。 */
export function formatUtcClock(now: Date = new Date()): string {
  const iso = now.toISOString();
  return `${iso.slice(11, 19)} UTC`;
}

/** 相对时间：刚刚 / 12 分钟前 / 3 天前。入参为秒级时间戳。 */
export function formatRelativeFromSeconds(seconds: number | null, now: Date = new Date()): string {
  if (seconds === null || !Number.isFinite(seconds)) return '—';
  const diffSeconds = Math.floor(now.getTime() / 1000) - seconds;
  if (diffSeconds < 60) return '刚刚';
  if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)} 分钟前`;
  if (diffSeconds < 86_400) return `${Math.floor(diffSeconds / 3600)} 小时前`;
  if (diffSeconds < 2_592_000) return `${Math.floor(diffSeconds / 86_400)} 天前`;
  return `${Math.floor(diffSeconds / 2_592_000)} 个月前`;
}

/** ISO 时间戳 → 本地 YYYY-MM-DD HH:MM。 */
export function formatIsoLocal(iso: string | null): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return `${localDayKey(date)} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}
