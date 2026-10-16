import { defineStore } from 'pinia';
import { computed, ref, watch } from 'vue';
import { DEFAULT_THEME, getTheme, isThemeId, THEMES, type ThemeId } from '@/config/themes';
import { readText, STORAGE_KEYS, writeText } from '@/services/storage';

/**
 * 主题状态：把选中的主题写到 <html data-theme>，由 tokens.css 里的
 * 变量覆盖块接管配色。同时同步浏览器地址栏/状态栏用的 theme-color。
 */
export const useThemeStore = defineStore('theme', () => {
  const stored = readText(STORAGE_KEYS.theme, DEFAULT_THEME);
  const themeId = ref<ThemeId>(isThemeId(stored) ? stored : DEFAULT_THEME);
  const theme = computed(() => getTheme(themeId.value));

  function apply(id: ThemeId): void {
    const root = globalThis.document?.documentElement;
    if (!root) return;
    root.dataset['theme'] = id;

    const meta = globalThis.document?.querySelector('meta[name="theme-color"]');
    meta?.setAttribute('content', getTheme(id).themeColor);
  }

  function setTheme(id: ThemeId): void {
    themeId.value = id;
  }

  // 立即套用一次（index.html 里也有一段同样的防闪烁脚本，这里负责对齐 DOM 与状态）
  apply(themeId.value);

  watch(themeId, (id) => {
    apply(id);
    writeText(STORAGE_KEYS.theme, id);
  });

  return { themeId, theme, themes: THEMES, setTheme };
});
