import { APP_CONFIG } from '@/config/app.config';
import { buildCodeforcesStats } from '@/domain/codeforces';
import type { CfApiResponse, CfSubmission, CfUser, CodeforcesStats } from '@/types/codeforces';

const API_ROOT = 'https://codeforces.com/api';

export type CodeforcesErrorKind =
  | 'not-found'
  | 'network'
  | 'api'
  | 'invalid-handle'
  | 'empty-result';

export class CodeforcesApiError extends Error {
  readonly kind: CodeforcesErrorKind;

  constructor(kind: CodeforcesErrorKind, message: string) {
    super(message);
    this.name = 'CodeforcesApiError';
    this.kind = kind;
  }
}

export function normalizeHandle(input: string): string {
  return input.trim().replace(/^@+/, '');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callApi<T>(method: string, params: Record<string, string | number>): Promise<T> {
  const url = new URL(`${API_ROOT}/${method}`);
  for (const [name, value] of Object.entries(params)) {
    url.searchParams.set(name, String(value));
  }

  let response: Response;
  try {
    // CF 的 /api/* 实测返回 Access-Control-Allow-Origin: *，浏览器可直连
    response = await fetch(url, { headers: { Accept: 'application/json' } });
  } catch {
    throw new CodeforcesApiError('network', '无法连接 codeforces.com，请检查网络或代理');
  }

  if (!response.ok) {
    throw new CodeforcesApiError(
      response.status === 503 ? 'network' : 'api',
      `Codeforces 返回 HTTP ${response.status}`,
    );
  }

  let payload: CfApiResponse<T>;
  try {
    payload = (await response.json()) as CfApiResponse<T>;
  } catch {
    throw new CodeforcesApiError('api', 'Codeforces 返回了无法解析的响应');
  }

  if (payload.status !== 'OK') {
    const comment = payload.comment ?? '未知错误';
    if (/not found/i.test(comment)) {
      throw new CodeforcesApiError('not-found', `找不到这个 handle：${comment}`);
    }
    throw new CodeforcesApiError('api', comment);
  }

  if (payload.result === undefined) {
    throw new CodeforcesApiError('empty-result', 'Codeforces 未返回数据');
  }

  return payload.result;
}

export function fetchUser(handle: string): Promise<CfUser[]> {
  return callApi<CfUser[]>('user.info', { handles: handle });
}

export function fetchSubmissions(handle: string, count: number): Promise<CfSubmission[]> {
  return callApi<CfSubmission[]>('user.status', { handle, from: 1, count });
}

/**
 * 拉取一次完整快照：user.info（rating/rank）+ user.status（提交窗口）。
 * 两次请求之间留出间隔，避免触发 CF 的频率限制。
 */
export async function syncCodeforces(
  rawHandle: string,
  now: Date = new Date(),
): Promise<CodeforcesStats> {
  const handle = normalizeHandle(rawHandle);
  if (!handle) {
    throw new CodeforcesApiError('invalid-handle', '请先在 [CONFIG] 里填写 Codeforces handle');
  }
  if (!/^[\w.-]{3,24}$/.test(handle)) {
    throw new CodeforcesApiError('invalid-handle', `handle 格式不合法：${handle}`);
  }

  const users = await fetchUser(handle);
  const user = users[0];
  if (!user) {
    throw new CodeforcesApiError('not-found', `找不到这个 handle：${handle}`);
  }

  await sleep(APP_CONFIG.codeforces.requestGapMs);

  const submissions = await fetchSubmissions(handle, APP_CONFIG.codeforces.submissionWindow);

  return buildCodeforcesStats({
    user,
    submissions,
    activityDays: APP_CONFIG.codeforces.activityDays,
    nowSeconds: Math.floor(now.getTime() / 1000),
  });
}
