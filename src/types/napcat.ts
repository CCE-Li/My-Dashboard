/** NapCat（OneBot 11 HTTP）相关的原始与派生类型。 */

/**
 * OneBot 11 通用响应信封：`{ status, retcode, data, message? }`。
 * retcode=0 且 status=ok 才算成功，其余一律视为业务错误。
 */
export interface OneBotEnvelope<T> {
  status?: string;
  retcode?: number;
  data?: T;
  message?: string;
  wording?: string;
}

/** `/get_status` 的 data */
export interface RawNapcatStatus {
  online?: boolean;
  good?: boolean;
}

/** `/get_version_info` 的 data */
export interface RawNapcatVersion {
  app_name?: string;
  app_version?: string;
  protocol_version?: string;
}

/** `/get_login_info` 的 data；user_id 可能是数字或字符串 */
export interface RawNapcatLoginInfo {
  user_id?: number | string;
  nickname?: string;
}

export interface NapcatView {
  /** 是否已连接 QQ 服务器 */
  online: boolean;
  /** 运行是否正常（OneBot 语义：good 表示整体健康） */
  good: boolean;
  appName: string;
  appVersion: string;
  protocolVersion: string;
  /** 登录的 QQ 号（去空白后的字符串，便于按原样展示） */
  uin: string;
  nickname: string;
  friendCount: number;
  groupCount: number;
}

export type NapcatHealth = 'online' | 'degraded' | 'offline';
