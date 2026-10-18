/**
 * 主题清单。
 *
 * 每个主题就是一组 CSS 变量覆盖（见 src/styles/tokens.css），
 * 通过 <html data-theme="..."> 生效。组件里不得出现硬编码色值，
 * 否则换主题时那一处不会跟着变。
 */

export type ThemeId = 'cyberpunk' | 'bladerunner' | 'vt220' | 'simplex';

export interface ThemeDefinition {
  id: ThemeId;
  /** 选择器里展示的短标签 */
  label: string;
  /** 悬停提示里的完整说明 */
  description: string;
  /** 浏览器地址栏 / 移动端状态栏配色 */
  themeColor: string;
}

export const THEMES: readonly ThemeDefinition[] = [
  {
    id: 'cyberpunk',
    label: 'CYBERPUNK',
    description: '硬核工业风：近黑底 + 荧光绿主色 + 品红辅色（默认）',
    themeColor: '#050505',
  },
  {
    id: 'bladerunner',
    label: 'BLADE',
    description: 'Blade Runner 2049：琥珀色雾霾、低对比、暖反射',
    themeColor: '#120a04',
  },
  {
    id: 'vt220',
    label: 'VT220',
    description: 'DEC VT220 终端：深色屏幕上的黄色荧光字，带扫描线',
    themeColor: '#0a0d08',
  },
  {
    id: 'simplex',
    label: 'SIMPLEX',
    description: 'Simplex 噪声：石墨冷调底 + 程序生成的胶片颗粒纹理',
    themeColor: '#0a0c0f',
  },
];

export const DEFAULT_THEME: ThemeId = 'cyberpunk';

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === 'string' && THEMES.some((theme) => theme.id === value);
}

/** 取主题定义；无法识别的 id 回落到默认主题，保证界面不会因脏数据而失去样式。 */
export function getTheme(id: string): ThemeDefinition {
  const matched = THEMES.find((theme) => theme.id === id);
  if (matched) return matched;
  const fallback = THEMES.find((theme) => theme.id === DEFAULT_THEME);
  if (!fallback) throw new Error('主题配置为空');
  return fallback;
}

/** 依次切换主题（给键盘快捷键用）。 */
export function nextTheme(current: string, direction: 1 | -1): ThemeId {
  const index = THEMES.findIndex((theme) => theme.id === current);
  const safeIndex = index === -1 ? 0 : index;
  const nextIndex = Math.min(THEMES.length - 1, Math.max(0, safeIndex + direction));
  const next = THEMES[nextIndex];
  return next ? next.id : DEFAULT_THEME;
}
