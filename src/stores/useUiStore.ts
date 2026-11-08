import { defineStore } from 'pinia';
import { ref } from 'vue';

/**
 * 全局 UI 状态：应用级设置弹窗、某块磁贴的设置弹窗、某块磁贴的「穿越」详情弹窗。
 * 三者互斥（同时只开一个）。
 *
 * 这里的磁贴 id 用 string：store 不能 import TileId，否则会和
 * registry（它 import 组件、组件又 import 本 store）形成类型环。
 * 真正的校验交给消费处的 isTileId。
 */
export const useUiStore = defineStore('ui', () => {
  const settingsOpen = ref(false);
  /** 当前打开的磁贴设置弹窗 id；null 表示没有 */
  const tileSettingsId = ref<string | null>(null);
  /** 当前打开的磁贴详情（穿越）弹窗 id；null 表示没有 */
  const detailTileId = ref<string | null>(null);

  function openSettings(): void {
    tileSettingsId.value = null;
    detailTileId.value = null;
    settingsOpen.value = true;
  }

  function closeSettings(): void {
    settingsOpen.value = false;
  }

  function openTileSettings(id: string): void {
    settingsOpen.value = false;
    detailTileId.value = null;
    tileSettingsId.value = id;
  }

  function closeTileSettings(): void {
    tileSettingsId.value = null;
  }

  function openTileDetail(id: string): void {
    settingsOpen.value = false;
    tileSettingsId.value = null;
    detailTileId.value = id;
  }

  function closeTileDetail(): void {
    detailTileId.value = null;
  }

  return {
    settingsOpen,
    tileSettingsId,
    detailTileId,
    openSettings,
    closeSettings,
    openTileSettings,
    closeTileSettings,
    openTileDetail,
    closeTileDetail,
  };
});
