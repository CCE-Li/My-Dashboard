import { APP_CONFIG } from '@/config/app.config';
import { isUsageSnapshot } from '@/domain/usage';
import type { UsageSnapshot } from '@/types/usage';

export class UsageDataError extends Error {
  readonly hint: string;

  constructor(message: string, hint: string) {
    super(message);
    this.name = 'UsageDataError';
    this.hint = hint;
  }
}

/** 数据文件的真实地址（开发与 GitHub Pages 子路径都正确）。 */
export function usageDataUrl(): string {
  const base = import.meta.env.BASE_URL || './';
  const origin = globalThis.location?.href ?? 'http://localhost/';
  return new URL(APP_CONFIG.usage.dataPath, new URL(base, origin)).toString();
}

/**
 * 读取 Command Code 用量快照。
 *
 * 数据由 `npm run sync:usage` 扫描本机 `~/.commandcode/projects/**` 生成，
 * 放在 `public/data/command-code-usage.json`。浏览器不能直接读本地文件，
 * 这是在不依赖任何私有接口的前提下拿到真实用量的方式。
 */
export async function fetchUsageSnapshot(signal?: AbortSignal): Promise<UsageSnapshot> {
  const url = usageDataUrl();
  let response: Response;
  try {
    response = await fetch(url, { signal, cache: 'no-store' });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new UsageDataError('无法读取用量数据文件', `请先运行 npm run sync:usage（期望路径：${url}）`);
  }

  if (!response.ok) {
    throw new UsageDataError(
      `用量数据文件返回 HTTP ${response.status}`,
      `请先运行 npm run sync:usage（期望路径：${url}）`,
    );
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new UsageDataError('用量数据文件不是合法 JSON', '重新运行 npm run sync:usage');
  }

  if (!isUsageSnapshot(payload)) {
    throw new UsageDataError('用量数据文件结构不符合预期', '重新运行 npm run sync:usage');
  }

  return payload;
}
