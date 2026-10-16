/**
 * 搜索磁贴的平台清单。
 *
 * 每个平台声明三件事：结果页地址（表单 action）、关键词参数名、官网主界面。
 * 新增平台只需往 SEARCH_PLATFORMS 里加一条，磁贴界面与官网跳转都会自动跟上。
 */

export type SearchPlatformId =
  | 'bilibili'
  | 'youtube'
  | 'github'
  | 'google'
  | 'bing'
  | 'baidu'
  | 'zhihu';

export interface SearchPlatform {
  id: SearchPlatformId;
  /** 选项框与官网 tooltip 上展示的名字 */
  label: string;
  /** 搜索结果页地址，作为表单 action 使用 */
  searchEndpoint: string;
  /** 该平台的关键词参数名 */
  queryParam: string;
  /** 官网主界面，供磁贴右上角的跳转按钮使用 */
  homeUrl: string;
}

export const SEARCH_PLATFORMS: readonly SearchPlatform[] = [
  {
    id: 'bilibili',
    label: 'BILIBILI',
    searchEndpoint: 'https://search.bilibili.com/all',
    queryParam: 'keyword',
    homeUrl: 'https://www.bilibili.com',
  },
  {
    id: 'youtube',
    label: 'YOUTUBE',
    searchEndpoint: 'https://www.youtube.com/results',
    queryParam: 'search_query',
    homeUrl: 'https://www.youtube.com',
  },
  {
    id: 'github',
    label: 'GITHUB',
    searchEndpoint: 'https://github.com/search',
    queryParam: 'q',
    homeUrl: 'https://github.com',
  },
  {
    id: 'google',
    label: 'GOOGLE',
    searchEndpoint: 'https://www.google.com/search',
    queryParam: 'q',
    homeUrl: 'https://www.google.com',
  },
  {
    id: 'bing',
    label: 'BING',
    searchEndpoint: 'https://www.bing.com/search',
    queryParam: 'q',
    homeUrl: 'https://www.bing.com',
  },
  {
    id: 'baidu',
    label: 'BAIDU',
    searchEndpoint: 'https://www.baidu.com/s',
    queryParam: 'wd',
    homeUrl: 'https://www.baidu.com',
  },
  {
    id: 'zhihu',
    label: 'ZHIHU',
    searchEndpoint: 'https://www.zhihu.com/search',
    queryParam: 'q',
    homeUrl: 'https://www.zhihu.com',
  },
];

/** 默认平台：B 站 */
export const DEFAULT_SEARCH_PLATFORM: SearchPlatformId = 'bilibili';

export function isSearchPlatformId(value: unknown): value is SearchPlatformId {
  return (
    typeof value === 'string' && SEARCH_PLATFORMS.some((platform) => platform.id === value)
  );
}

/** 取平台配置；遇到无法识别的 id 时回落到默认平台，保证界面不会因脏数据而崩。 */
export function getSearchPlatform(id: string): SearchPlatform {
  const matched = SEARCH_PLATFORMS.find((platform) => platform.id === id);
  if (matched) return matched;
  const fallback = SEARCH_PLATFORMS.find((platform) => platform.id === DEFAULT_SEARCH_PLATFORM);
  if (!fallback) throw new Error('搜索平台配置为空');
  return fallback;
}

/** 拼出带关键词的结果页地址（用于 QUICK_TAGS 这类直接跳转的链接）。 */
export function buildSearchUrl(platform: SearchPlatform, keyword: string): string {
  const url = new URL(platform.searchEndpoint);
  url.searchParams.set(platform.queryParam, keyword);
  return url.toString();
}
