/**
 * 应用级配置。需要改动默认行为时改这里，而不是散落在组件里。
 */
export const APP_CONFIG = {
  /** 顶部状态栏与页脚展示的产品标识 */
  productName: 'GRID_STARTPAGE',
  version: 'v5.0',
  /** 实时时钟刷新间隔（毫秒） */
  clockIntervalMs: 1000,

  codeforces: {
    /**
     * 默认 Codeforces handle。留空则在首次访问时由磁贴上的 [CONFIG] 面板填写，
     * 填写结果存 localStorage，不写回仓库（仓库里不留个人账号信息）。
     */
    defaultHandle: '',
    /** 一次抓取拉取的最近提交条数（CF 接口上限 10000） */
    submissionWindow: 10000,
    /** 活动条展示的天数 */
    activityDays: 20,
    /** 成功后缓存时长（毫秒），避免频繁打 CF 接口 */
    cacheTtlMs: 10 * 60 * 1000,
    /** 失败后的退避缓存时长（毫秒） */
    errorCacheTtlMs: 60 * 1000,
    /** 两次 CF 接口调用之间的间隔（毫秒），CF 建议不要密集请求 */
    requestGapMs: 400,
  },

  usage: {
    /** 采集器生成的数据文件（相对 base 解析） */
    dataPath: 'data/command-code-usage.json',
  },

  brzFund: {
    /** 必须与 BRZ-Fund/src/db/schema.ts 的 DB_NAME 一致 */
    dbName: 'brz-fund',
    goalId: 'current',
    settingsId: 'app',
    /** BRZ-Fund 备份信封的标识，用于校验导入文件 */
    backupAppId: 'brz-fund',
  },
} as const;
