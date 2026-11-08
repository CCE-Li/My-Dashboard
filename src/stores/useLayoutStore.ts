import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { readJson, removeKey, STORAGE_KEYS, writeJson } from '@/services/storage';
import { TILE_IDS, type TileId } from '@/tiles/registry';

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

/**
 * 隐藏集合同样与注册表对齐：丢弃已下线的 id、去重。
 * 新增的磁贴不在集合里，因此默认是可见的。
 */
function reconcileHidden(saved: readonly string[]): TileId[] {
  return [...new Set(saved.filter(isTileId))];
}

export const useLayoutStore = defineStore('layout', () => {
  const order = ref<TileId[]>(reconcile(readJson<string[]>(STORAGE_KEYS.tileOrder, [...TILE_IDS])));
  const hidden = ref<TileId[]>(
    reconcileHidden(readJson<string[]>(STORAGE_KEYS.tileHidden, [])),
  );

  /** 当前实际渲染的磁贴 id，保持用户的顺序 */
  const visibleIds = computed(() => order.value.filter((id) => !hidden.value.includes(id)));

  const isCustomised = computed(
    () =>
      order.value.join(',') !== [...TILE_IDS].join(',') ||
      hidden.value.length > 0,
  );

  function persist(): void {
    writeJson(STORAGE_KEYS.tileOrder, order.value);
  }

  function persistHidden(): void {
    writeJson(STORAGE_KEYS.tileHidden, hidden.value);
  }

  function isVisible(id: TileId): boolean {
    return !hidden.value.includes(id);
  }

  /** 切换单个磁贴的显示/隐藏；顺序不动，重新显示时回到原位置 */
  function setVisible(id: TileId, visible: boolean): void {
    const next = new Set(hidden.value);
    if (visible) next.delete(id);
    else next.add(id);
    hidden.value = [...next];
    persistHidden();
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

  /** 恢复默认：顺序回到注册表顺序，并让所有磁贴重新可见 */
  function resetLayout(): void {
    removeKey(STORAGE_KEYS.tileOrder);
    removeKey(STORAGE_KEYS.tileHidden);
    order.value = [...TILE_IDS];
    hidden.value = [];
  }

  return {
    order,
    hidden,
    visibleIds,
    isCustomised,
    isVisible,
    setVisible,
    moveTile,
    resetLayout,
  };
});
