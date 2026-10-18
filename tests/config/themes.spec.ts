import { describe, expect, it } from 'vitest';
import { DEFAULT_THEME, getTheme, isThemeId, nextTheme, THEMES } from '@/config/themes';

describe('主题清单', () => {
  it('默认是 CYBERPUNK', () => {
    expect(DEFAULT_THEME).toBe('cyberpunk');
    expect(getTheme(DEFAULT_THEME).label).toBe('CYBERPUNK');
  });

  it('包含用户指定的三种风格', () => {
    const ids = THEMES.map((theme) => theme.id);
    expect(ids).toContain('bladerunner');
    expect(ids).toContain('vt220');
    expect(ids).toContain('simplex');
  });

  it('id 唯一、标签与说明非空、themeColor 是合法 hex', () => {
    const ids = THEMES.map((theme) => theme.id);
    expect(new Set(ids).size).toBe(ids.length);

    for (const theme of THEMES) {
      expect(theme.label.length).toBeGreaterThan(0);
      expect(theme.description.length).toBeGreaterThan(0);
      expect(theme.themeColor).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('无法识别的 id 回落到默认主题', () => {
    expect(getTheme('solarized').id).toBe('cyberpunk');
    expect(getTheme('').id).toBe('cyberpunk');
  });

  it('isThemeId 只认已登记的主题', () => {
    expect(isThemeId('vt220')).toBe(true);
    expect(isThemeId('solarized')).toBe(false);
    expect(isThemeId(null)).toBe(false);
    expect(isThemeId(7)).toBe(false);
  });
});

describe('nextTheme', () => {
  it('按顺序前后切换', () => {
    expect(nextTheme('cyberpunk', 1)).toBe('bladerunner');
    expect(nextTheme('bladerunner', 1)).toBe('vt220');
    expect(nextTheme('vt220', 1)).toBe('simplex');
    expect(nextTheme('simplex', -1)).toBe('vt220');
  });

  it('到边界后钳制，不会绕回', () => {
    expect(nextTheme('cyberpunk', -1)).toBe('cyberpunk');
    expect(nextTheme('simplex', 1)).toBe('simplex');
  });

  it('起点是脏数据时从默认主题开始走', () => {
    expect(nextTheme('garbage', 1)).toBe('bladerunner');
    expect(nextTheme('garbage', -1)).toBe('cyberpunk');
  });
});
