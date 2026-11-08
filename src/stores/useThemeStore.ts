import { defineStore } from 'pinia';
import { computed, ref, watch } from 'vue';
import { DEFAULT_THEME, getTheme, isThemeId, THEMES, type ThemeId } from '@/config/themes';
import { readText, STORAGE_KEYS, writeText } from '@/services/storage';

/** 磨砂程度默认值（0–100），与 tokens.css 里的 --glass-pct: 55% 对齐 */
const GLASS_DEFAULT = 55;

function clampGlass(value: number): number {
  if (!Number.isFinite(value)) return GLASS_DEFAULT;
  return Math.min(100, Math.max(0, Math.round(value)));
}

/**
 * 主题与外观状态：选中的主题写到 <html data-theme>，由 tokens.css 的变量覆盖块
 * 接管配色；磨砂程度写成 :root 上的 --glass-pct / --glass-blur 覆盖 token。
 * 同时同步浏览器地址栏/状态栏用的 theme-color。
 */
export const useThemeStore = defineStore('theme', () => {
  const stored = readText(STORAGE_KEYS.theme, DEFAULT_THEME);
  const themeId = ref<ThemeId>(isThemeId(stored) ? stored : DEFAULT_THEME);
  const theme = computed(() => getTheme(themeId.value));

  const glass = ref(clampGlass(Number(readText(STORAGE_KEYS.glassFrost, String(GLASS_DEFAULT)))));

  function apply(id: ThemeId): void {
    const root = globalThis.document?.documentElement;
    if (!root) return;
    root.dataset['theme'] = id;

    const meta = globalThis.document?.querySelector('meta[name="theme-color"]');
    meta?.setAttribute('content', getTheme(id).themeColor);
  }

  /** 磨砂程度 → 模糊半径（0–24px）与不透明度（30%–80%） */
  function applyGlass(value: number): void {
    const root = globalThis.document?.documentElement;
    if (!root) return;
    const ratio = clampGlass(value) / 100;
    root.style.setProperty('--glass-blur', `${(ratio * 24).toFixed(1)}px`);
    root.style.setProperty('--glass-pct', `${Math.round(30 + ratio * 50)}%`);
  }

  function setTheme(id: ThemeId): void {
    themeId.value = id;
  }

  function setGlass(value: number): void {
    glass.value = clampGlass(value);
  }

  // 立即套用一次（index.html 里也有一段同样的防闪烁脚本，这里负责对齐 DOM 与状态）
  apply(themeId.value);
  applyGlass(glass.value);

  watch(themeId, (id) => {
    apply(id);
    writeText(STORAGE_KEYS.theme, id);
  });

  watch(glass, (value) => {
    applyGlass(value);
    writeText(STORAGE_KEYS.glassFrost, String(value));
  });

  return { themeId, theme, themes: THEMES, glass, setTheme, setGlass };
});
