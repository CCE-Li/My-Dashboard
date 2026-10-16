import type { TileDefinition, TileId } from '@/types/dashboard';
import BrzTile from './BrzTile.vue';
import CodeforcesTile from './CodeforcesTile.vue';
import ModelMatrixTile from './ModelMatrixTile.vue';
import SearchTile from './SearchTile.vue';
import TokenUsageTile from './TokenUsageTile.vue';

/**
 * 磁贴注册表 —— 本仓库唯一的「加功能」入口。
 *
 * 新增一个磁贴只要三步：
 * 1. 在 src/tiles/ 下写一个组件（内部用 TileFrame 包壳）；
 * 2. 在下面的 TILES 数组里加一条，给它一个全新的 id；
 * 3. 完成。布局顺序、拖拽、持久化、重置都由 registry 驱动，无需改其它文件。
 *
 * 注意：id 是布局持久化的键，发布后不要改名；删掉某条后，用户既有的
 * 布局会自动跳过它（见 useLayoutStore 的 reconcile）。
 */
export const TILES: readonly TileDefinition[] = [
  {
    id: 'search',
    span: 'full',
    label: '搜索网关',
    component: SearchTile,
  },
  {
    id: 'brz',
    span: 'single',
    label: 'BRZ 购车基金',
    component: BrzTile,
  },
  {
    id: 'usage',
    span: 'single',
    label: 'API Token 监控',
    component: TokenUsageTile,
  },
  {
    id: 'codeforces',
    span: 'single',
    label: 'Codeforces 进度',
    component: CodeforcesTile,
  },
  {
    id: 'models',
    span: 'wide',
    label: '模型用量矩阵',
    component: ModelMatrixTile,
  },
];

export const TILE_IDS: readonly TileId[] = TILES.map((tile) => tile.id);

const TILE_MAP = new Map<TileId, TileDefinition>(TILES.map((tile) => [tile.id, tile]));

export function getTileDefinition(id: TileId): TileDefinition {
  const definition = TILE_MAP.get(id);
  if (!definition) throw new Error(`未注册的磁贴 id: ${id}`);
  return definition;
}

export function resolveTiles(order: readonly TileId[]): TileDefinition[] {
  return order.map(getTileDefinition);
}
