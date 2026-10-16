import type { Component } from 'vue';

/** 磁贴 id：作为拖拽顺序持久化的稳定键，一旦发布不得重命名。 */
export type TileId = 'search' | 'brz' | 'usage' | 'codeforces' | 'models';

/** 磁贴跨列宽度。full = 整行；wide = 桌面端两列；single = 一列。 */
export type TileSpan = 'full' | 'wide' | 'single';

export interface TileDefinition {
  id: TileId;
  span: TileSpan;
  /** 无障碍与页脚提示用的中文名 */
  label: string;
  component: Component;
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
