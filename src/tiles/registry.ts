import type { TileDefinition } from '@/types/dashboard';
import BinanceTile from './BinanceTile.vue';
import BrzTile from './BrzTile.vue';
import CodeforcesTile from './CodeforcesTile.vue';
import ModelMatrixTile from './ModelMatrixTile.vue';
import NapcatTile from './NapcatTile.vue';
import SearchTile from './SearchTile.vue';
import ServerTile from './ServerTile.vue';
import TokenUsageTile from './TokenUsageTile.vue';
import BinanceSettings from './settings/BinanceSettings.vue';
import BrzSettings from './settings/BrzSettings.vue';
import CodeforcesSettings from './settings/CodeforcesSettings.vue';
import NapcatSettings from './settings/NapcatSettings.vue';
import QuotaSettings from './settings/QuotaSettings.vue';
import SearchSettings from './settings/SearchSettings.vue';
import ServerSettings from './settings/ServerSettings.vue';
import UsageSettings from './settings/UsageSettings.vue';

/**
 * 磁贴注册表 —— 本仓库唯一的「加功能」入口。
 *
 * 新增一个磁贴只要两步：
 * 1. 在 src/tiles/ 下写一个组件（内部用 TileFrame 包壳）；
 * 2. 在下面的 TILES 数组里加一条，给它一个全新的 id。
 * 布局顺序、拖拽、持久化、重置都由 registry 驱动，无需改其它文件。
 *
 * 如果磁贴有配置项，再写一个 src/tiles/settings/ 下的设置组件，挂到该条的
 * settings 字段 —— 点磁贴上的 [CONFIG] 会打开这块磁贴自己的设置弹窗。
 *
 * id 是布局持久化的键，发布后不要改名；删掉某条后，用户既有的
 * 布局会自动跳过它（见 useLayoutStore 的 reconcile）。
 *
 * TileId 由 TILES 推导而来 —— 加一条记录，联合类型自动跟上，
 * 不再需要去 types/ 手工同步一份 id 清单。
 */
export const TILES = [
  { id: 'search', span: 'full', label: '搜索网关', component: SearchTile, settings: SearchSettings },
  { id: 'brz', span: 'single', label: 'BRZ 购车基金', component: BrzTile, settings: BrzSettings },
  {
    id: 'usage',
    span: 'single',
    label: 'API Token 监控',
    component: TokenUsageTile,
    settings: UsageSettings,
  },
  {
    id: 'codeforces',
    span: 'single',
    label: 'Codeforces 进度',
    component: CodeforcesTile,
    settings: CodeforcesSettings,
  },
  {
    id: 'models',
    span: 'wide',
    label: '模型用量矩阵',
    component: ModelMatrixTile,
    settings: QuotaSettings,
  },
  {
    id: 'binance',
    span: 'wide',
    label: '币安合约持仓',
    component: BinanceTile,
    settings: BinanceSettings,
  },
  {
    id: 'server',
    span: 'single',
    label: '服务器状态',
    component: ServerTile,
    settings: ServerSettings,
  },
  { id: 'napcat', span: 'single', label: 'NapCat / Bot', component: NapcatTile, settings: NapcatSettings },
] as const satisfies readonly TileDefinition[];

/** 磁贴 id：由注册表推导，作为拖拽顺序持久化的稳定键 */
export type TileId = (typeof TILES)[number]['id'];

export const TILE_IDS: readonly TileId[] = TILES.map((tile) => tile.id);

/**
 * 校验任意值是否是已注册的磁贴 id。
 *
 * 供 UI store 使用：store 不能 import TileId —— 否则会形成
 * useUiStore ↔ registry ↔ 组件 的类型环。store 里用 string，边界处再校验。
 */
export function isTileId(value: unknown): value is TileId {
  return typeof value === 'string' && (TILE_IDS as readonly string[]).includes(value);
}

const TILE_MAP = new Map<TileId, TileDefinition<TileId>>(
  TILES.map((tile): [TileId, TileDefinition<TileId>] => [tile.id, tile]),
);

export function getTileDefinition(id: TileId): TileDefinition<TileId> {
  const definition = TILE_MAP.get(id);
  if (!definition) throw new Error(`未注册的磁贴 id: ${id}`);
  return definition;
}

export function resolveTiles(order: readonly TileId[]): TileDefinition<TileId>[] {
  return order.map(getTileDefinition);
}
