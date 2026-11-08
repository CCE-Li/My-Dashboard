import { APP_CONFIG } from '@/config/app.config';
import type {
  OneBotEnvelope,
  RawNapcatLoginInfo,
  RawNapcatStatus,
  RawNapcatVersion,
} from '@/types/napcat';

/**
 * NapCat 的 OneBot 11 HTTP 客户端。
 *
 * 只读调用五个端点：get_status / get_version_info / get_login_info /
 * get_friend_list / get_group_list。鉴权走 `Authorization: Bearer <token>`。
 *
 * 浏览器直连要求 NapCat 的 HTTP 服务允许 CORS；https 页面无法请求 http 地址
 * （混合内容），线上部署要么把仪表盘放在服务器本地，要么给 NapCat 套 https 反代。
 */

export const DEFAULT_NAPCAT_BASE_URL = APP_CONFIG.napcat.defaultBaseUrl;

export type NapcatErrorKind = 'network' | 'non-json' | 'unauthorized' | 'api';

export class NapcatApiError extends Error {
  readonly kind: NapcatErrorKind;
  readonly retcode: number | null;

  constructor(kind: NapcatErrorKind, message: string, retcode: number | null = null) {
    super(message);
    this.name = 'NapcatApiError';
    this.kind = kind;
    this.retcode = retcode;
  }
}

/** 规整地址：空或非法时回落默认值（与 Binance 磁贴同款策略）。 */
export function normalizeNapcatBaseUrl(input: string): string {
  const trimmed = input.trim().replace(/\/+$/, '');
  if (!trimmed) return DEFAULT_NAPCAT_BASE_URL;
  if (!/^https?:\/\//i.test(trimmed)) return DEFAULT_NAPCAT_BASE_URL;
  return trimmed;
}

async function callOneBot<T>(baseUrl: string, path: string, token: string): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  const trimmedToken = token.trim();
  if (trimmedToken) headers['Authorization'] = `Bearer ${trimmedToken}`;

  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, { headers, cache: 'no-store' });
  } catch {
    throw new NapcatApiError(
      'network',
      `无法连接 ${baseUrl}，请检查地址、CORS 与混合内容限制`,
    );
  }

  if (response.status === 401 || response.status === 403) {
    throw new NapcatApiError(
      'unauthorized',
      `鉴权失败（HTTP ${response.status}），请检查 access token`,
    );
  }

  const text = await response.text();
  let payload: OneBotEnvelope<T>;
  try {
    payload = JSON.parse(text) as OneBotEnvelope<T>;
  } catch {
    throw new NapcatApiError('non-json', `NapCat 返回了非 JSON 响应（HTTP ${response.status}）`);
  }

  const retcode = typeof payload.retcode === 'number' ? payload.retcode : null;
  if (retcode !== null && retcode !== 0) {
    const detail = payload.message || payload.wording || `retcode=${retcode}`;
    throw new NapcatApiError('api', `NapCat 返回错误：${detail}`, retcode);
  }
  if (payload.data === undefined || payload.data === null) {
    throw new NapcatApiError('api', 'NapCat 响应缺少 data 字段');
  }

  return payload.data;
}

export interface NapcatSnapshot {
  status: RawNapcatStatus;
  version: RawNapcatVersion;
  login: RawNapcatLoginInfo;
  friendCount: number;
  groupCount: number;
}

function countOf(result: PromiseSettledResult<unknown>): number {
  return result.status === 'fulfilled' && Array.isArray(result.value) ? result.value.length : 0;
}

/**
 * 拉取一次快照。
 *
 * get_status 是必需项（失败即整体失败）；版本/登录/好友/群列表都可能因 token
 * 权限而被拒，任一失败只让对应字段退化，不影响「在线状态」的展示。
 */
export async function fetchNapcatSnapshot(
  baseUrl: string,
  token: string,
): Promise<NapcatSnapshot> {
  const [statusR, versionR, loginR, friendsR, groupsR] = await Promise.allSettled([
    callOneBot<RawNapcatStatus>(baseUrl, '/get_status', token),
    callOneBot<RawNapcatVersion>(baseUrl, '/get_version_info', token),
    callOneBot<RawNapcatLoginInfo>(baseUrl, '/get_login_info', token),
    callOneBot<unknown[]>(baseUrl, '/get_friend_list', token),
    callOneBot<unknown[]>(baseUrl, '/get_group_list', token),
  ]);

  if (statusR.status === 'rejected') throw statusR.reason;

  return {
    status: statusR.value,
    version: versionR.status === 'fulfilled' ? versionR.value : {},
    login: loginR.status === 'fulfilled' ? loginR.value : {},
    friendCount: countOf(friendsR),
    groupCount: countOf(groupsR),
  };
}

/** 设置面板里的「测试」：只要 get_status 能通就算连接成功。 */
export async function pingNapcat(
  baseUrl: string,
  token: string,
): Promise<{ online: boolean; appVersion: string }> {
  const version = await callOneBot<RawNapcatVersion>(baseUrl, '/get_version_info', token);
  const status = await callOneBot<RawNapcatStatus>(baseUrl, '/get_status', token);
  return { online: status.online === true, appVersion: version.app_version ?? 'unknown' };
}
