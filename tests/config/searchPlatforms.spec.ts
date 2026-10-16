import { describe, expect, it } from 'vitest';
import {
  buildSearchUrl,
  DEFAULT_SEARCH_PLATFORM,
  getSearchPlatform,
  isSearchPlatformId,
  SEARCH_PLATFORMS,
} from '@/config/searchPlatforms';

describe('搜索平台配置', () => {
  it('默认平台是 B 站', () => {
    expect(DEFAULT_SEARCH_PLATFORM).toBe('bilibili');
    expect(getSearchPlatform(DEFAULT_SEARCH_PLATFORM).label).toBe('BILIBILI');
  });

  it('包含用户要求的三个平台', () => {
    const ids = SEARCH_PLATFORMS.map((platform) => platform.id);
    expect(ids).toContain('bilibili');
    expect(ids).toContain('youtube');
    expect(ids).toContain('github');
  });

  it('id 唯一、地址均为 https、关键词参数非空', () => {
    const ids = SEARCH_PLATFORMS.map((platform) => platform.id);
    expect(new Set(ids).size).toBe(ids.length);

    for (const platform of SEARCH_PLATFORMS) {
      expect(platform.searchEndpoint.startsWith('https://')).toBe(true);
      expect(platform.homeUrl.startsWith('https://')).toBe(true);
      expect(platform.queryParam.length).toBeGreaterThan(0);
    }
  });

  it('无法识别的 id 回落到默认平台，而不是抛错', () => {
    expect(getSearchPlatform('weibo').id).toBe('bilibili');
    expect(getSearchPlatform('').id).toBe('bilibili');
  });

  it('isSearchPlatformId 只认已登记的平台', () => {
    expect(isSearchPlatformId('github')).toBe(true);
    expect(isSearchPlatformId('weibo')).toBe(false);
    expect(isSearchPlatformId(null)).toBe(false);
    expect(isSearchPlatformId(42)).toBe(false);
  });
});

describe('buildSearchUrl', () => {
  it('按各平台自己的参数名拼接', () => {
    expect(buildSearchUrl(getSearchPlatform('bilibili'), 'BRZ')).toBe(
      'https://search.bilibili.com/all?keyword=BRZ',
    );
    expect(buildSearchUrl(getSearchPlatform('youtube'), 'BRZ')).toBe(
      'https://www.youtube.com/results?search_query=BRZ',
    );
    expect(buildSearchUrl(getSearchPlatform('github'), 'BRZ')).toBe(
      'https://github.com/search?q=BRZ',
    );
    expect(buildSearchUrl(getSearchPlatform('baidu'), 'BRZ')).toBe(
      'https://www.baidu.com/s?wd=BRZ',
    );
  });

  it('对关键词做 URL 编码，中文与空格不会拼坏', () => {
    expect(buildSearchUrl(getSearchPlatform('bilibili'), '斯巴鲁 BRZ')).toBe(
      'https://search.bilibili.com/all?keyword=%E6%96%AF%E5%B7%B4%E9%B2%81+BRZ',
    );
  });
});
