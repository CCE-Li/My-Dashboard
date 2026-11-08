import { defineStore } from 'pinia';
import { ref } from 'vue';

/**
 * 全局 UI 状态：应用级设置弹窗（主题 / 磁贴显隐 / 布局），
 * 以及「哪块磁贴的设置弹窗开着」—— 用 store 而不是逐层 emit，
 * 这样顶栏与任意磁贴都能直接打开对应面板。
 *
 * 这里的磁贴 id 用 string：store 不能 import TileId，否则会和
 * registry（它 import 组件、组件又 import 本 store）形成类型环。
 * 真正的校验交给 TileSettingsDialog 里的 isTileId。
 */
export const useUiStore = defineStore('ui', () => {
  const settingsOpen = ref(false);
  /** 当前打开的磁贴设置弹窗 id；null 表示没有 */
  const tileSettingsId = ref<string | null>(null);

  function openSettings(): void {
    settingsOpen.value = true;
  }

  function closeSettings(): void {
    settingsOpen.value = false;
  }

  function openTileSettings(id: string): void {
    tileSettingsId.value = id;
  }

  function closeTileSettings(): void {
    tileSettingsId.value = null;
  }

  return {
    settingsOpen,
    tileSettingsId,
    openSettings,
    closeSettings,
    openTileSettings,
    closeTileSettings,
  };
});
