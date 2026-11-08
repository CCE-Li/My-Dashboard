/** 服务器只读指标端点相关的原始与派生类型。 */

/**
 * 指标端点约定的返回结构。所有字段都可缺省 —— 缺省项按 0/空处理，
 * 这样端点多给或少给几个字段都不会让磁贴崩掉。
 *
 * 字段对应的采集脚本见 scripts/server-metrics-agent.mjs。
 */
export interface RawServerMetrics {
  hostname?: string;
  platform?: string;
  /** 运行时长（秒） */
  uptimeSec?: number;
  /** 1 / 5 / 15 分钟平均负载 */
  loadAvg?: number[];
  cpu?: {
    /** 0–100 的占用率 */
    usagePercent?: number;
    cores?: number;
  };
  memory?: {
    totalBytes?: number;
    usedBytes?: number;
  };
  disks?: Array<{
    mount?: string;
    totalBytes?: number;
    usedBytes?: number;
  }>;
  /** 端点生成该快照的时间（ISO 字符串） */
  generatedAt?: string;
}

export interface ServerDisk {
  mount: string;
  totalBytes: number;
  usedBytes: number;
  /** 0–100 的占用率 */
  percent: number;
}

export interface ServerView {
  hostname: string;
  platform: string;
  uptimeSec: number;
  loadAvg: number[];
  cpuPercent: number;
  cores: number;
  memoryTotalBytes: number;
  memoryUsedBytes: number;
  memoryPercent: number;
  /** 主磁盘（优先挂载点 /）；端点未提供磁盘时为 null */
  disk: ServerDisk | null;
  /** 全部磁盘（详情弹窗用） */
  disks: ServerDisk[];
  generatedAt: string | null;
}
