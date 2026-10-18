import { defineStore } from 'pinia';
import { ref } from 'vue';

/**
 * 全局 UI 状态。目前只有设置悬浮窗 —— 用 store 而不是逐层 emit，
 * 这样顶栏、任意磁贴都能直接打开它。
 */
export const useUiStore = defineStore('ui', () => {
  const settingsOpen = ref(false);

  function openSettings(): void {
    settingsOpen.value = true;
  }

  function closeSettings(): void {
    settingsOpen.value = false;
  }

  return { settingsOpen, openSettings, closeSettings };
});
