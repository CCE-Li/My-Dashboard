import type {
  NapcatHealth,
  NapcatView,
  RawNapcatLoginInfo,
  RawNapcatStatus,
  RawNapcatVersion,
} from '@/types/napcat';

/**
 * NapCat / OneBot 的纯计算层：归一化登录信息、合成视图、健康度判定。
 * 不碰网络、不碰 DOM，便于单测。
 */

function toText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** QQ 号统一成字符串（OneBot 可能给数字或字符串），空值返回空串。 */
export function normalizeUin(value: number | string | undefined): string {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'string') return value.trim();
  return '';
}

/** 把三组接口的返回合成一个视图模型。 */
export function buildNapcatView(
  status: RawNapcatStatus,
  version: RawNapcatVersion,
  login: RawNapcatLoginInfo,
  friendCount: number,
  groupCount: number,
): NapcatView {
  return {
    online: status.online === true,
    good: status.good === true,
    appName: toText(version.app_name) || 'NapCat',
    appVersion: toText(version.app_version) || 'unknown',
    protocolVersion: toText(version.protocol_version) || 'unknown',
    uin: normalizeUin(login.user_id),
    nickname: toText(login.nickname) || '未登录',
    friendCount: Number.isFinite(friendCount) ? friendCount : 0,
    groupCount: Number.isFinite(groupCount) ? groupCount : 0,
  };
}

/**
 * 三档健康度：
 * - offline：未连接 QQ 服务器
 * - degraded：已连接但 OneBot 报 good=false（部分能力异常）
 * - online：在线且正常
 */
export function healthOf(view: Pick<NapcatView, 'online' | 'good'>): NapcatHealth {
  if (!view.online) return 'offline';
  return view.good ? 'online' : 'degraded';
}
