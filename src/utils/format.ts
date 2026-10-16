const CURRENCY_SYMBOLS: Record<string, string> = {
  CNY: '¥',
  RMB: '¥',
  USD: '$',
  EUR: '€',
  JPY: '¥',
  GBP: '£',
};

const integerFormatter = new Intl.NumberFormat('zh-CN');

export function formatInteger(value: number): string {
  if (!Number.isFinite(value)) return '0';
  return integerFormatter.format(Math.round(value));
}

/**
 * 整数分 → 人类可读金额。分是 BRZ-Fund 的存储单位（1 元 = 100 分），
 * 展示时除以 100 并保留必要的小数位。
 */
export function formatCents(cents: number, currency = 'CNY'): string {
  const symbol = CURRENCY_SYMBOLS[currency.toUpperCase()] ?? `${currency} `;
  const safe = Number.isFinite(cents) ? cents : 0;
  const yuan = safe / 100;
  const fraction = Math.abs(yuan % 1) > 0.004;
  const text = new Intl.NumberFormat('zh-CN', {
    minimumFractionDigits: fraction ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(yuan);
  return `${symbol} ${text}`;
}

/** 大数压缩：782.8M / 19.5M / 12.3K。用于 token 总量展示。 */
export function formatTokens(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '0';
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return formatInteger(value);
}

export function formatPercent(value: number, digits = 1): string {
  if (!Number.isFinite(value)) return '0%';
  return `${value.toFixed(digits)}%`;
}

export function formatUsd(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '$0.00';
  if (value < 0.01) return `$${value.toFixed(4)}`;
  return `$${value.toFixed(2)}`;
}

/** 把 rank（如 "candidate master"）压成展示用的短标签。 */
export function formatRank(rank: string | null): string {
  if (!rank) return 'UNRATED';
  return rank.replace(/_/g, ' ').toUpperCase();
}
