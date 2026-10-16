import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { readJson, removeKey, STORAGE_KEYS, writeJson } from '@/services/storage';
import type { TileId } from '@/types/dashboard';
import { TILE_IDS } from '@/tiles/registry';

function isTileId(value: unknown): value is TileId {
  return typeof value === 'string' && (TILE_IDS as readonly string[]).includes(value);
}

/**
 * 把持久化的顺序与当前磁贴注册表对齐：
 * 丢弃已下线的 id，把新增的 id 追加到末尾。
 * 这样以后增删磁贴不需要清用户的布局。
 */
function reconcile(saved: readonly string[]): TileId[] {
  const valid = saved.filter(isTileId);
  const seen = new Set<TileId>(valid);
  const appended = TILE_IDS.filter((id) => !seen.has(id));
  return [...valid, ...appended];
}

export const useLayoutStore = defineStore('layout', () => {
  const order = ref<TileId[]>(reconcile(readJson<string[]>(STORAGE_KEYS.tileOrder, [...TILE_IDS])));

  const isCustomised = computed(
    () => order.value.join(',') !== [...TILE_IDS].join(','),
  );

  function persist(): void {
    writeJson(STORAGE_KEYS.tileOrder, order.value);
  }

  /** 把 dragged 移动到 target 之前或之后（与原始单文件版的落点语义一致）。 */
  function moveTile(dragged: TileId, target: TileId): void {
    if (dragged === target) return;

    const next = [...order.value];
    const fromIndex = next.indexOf(dragged);
    const targetIndex = next.indexOf(target);
    if (fromIndex === -1 || targetIndex === -1) return;

    next.splice(fromIndex, 1);
    const insertAt = fromIndex < targetIndex ? next.indexOf(target) + 1 : next.indexOf(target);
    next.splice(insertAt, 0, dragged);

    order.value = next;
    persist();
  }

  function resetOrder(): void {
    removeKey(STORAGE_KEYS.tileOrder);
    order.value = [...TILE_IDS];
  }

  return { order, isCustomised, moveTile, resetOrder };
});
