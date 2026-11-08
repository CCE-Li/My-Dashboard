import type { Component } from 'vue';

/** 磁贴跨列宽度。full = 整行；wide = 桌面端两列；single = 一列。 */
export type TileSpan = 'full' | 'wide' | 'single';

/**
 * 磁贴定义。id 作为泛型参数，注册表据此把 id 收窄成字面量联合，
 * 从而让 TileId 从 TILES 推导出来，不需要手工两处维护。
 */
export interface TileDefinition<Id extends string = string> {
  id: Id;
  span: TileSpan;
  /** 无障碍与页脚提示用的中文名 */
  label: string;
  component: Component;
  /** 该磁贴自己的设置面板；[CONFIG] 会打开它。无配置项的磁贴可省略 */
  settings?: Component;
}

export type LoadState = 'idle' | 'loading' | 'ready' | 'error';

/**
 * 数据来源可信度标记，直接展示在磁贴角标上：
 * live 实时接口 / cached 本地缓存 / imported 手动导入的快照 / empty 无数据。
 */
export type DataOrigin = 'live' | 'cached' | 'imported' | 'empty';

export interface ToastMessage {
  id: number;
  text: string;
}
