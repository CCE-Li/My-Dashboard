import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import {
  DEFAULT_SEARCH_PLATFORM,
  getSearchPlatform,
  isSearchPlatformId,
  SEARCH_PLATFORMS,
  type SearchPlatformId,
} from '@/config/searchPlatforms';
import { readText, STORAGE_KEYS, writeText } from '@/services/storage';

/** 搜索平台选择。放在 store 里，设置悬浮窗与搜索磁贴才会实时同步。 */
export const useSearchStore = defineStore('search', () => {
  const stored = readText(STORAGE_KEYS.searchPlatform, DEFAULT_SEARCH_PLATFORM);
  const platformId = ref<SearchPlatformId>(
    isSearchPlatformId(stored) ? stored : DEFAULT_SEARCH_PLATFORM,
  );
  const platform = computed(() => getSearchPlatform(platformId.value));

  function setPlatform(id: SearchPlatformId): void {
    platformId.value = id;
    writeText(STORAGE_KEYS.searchPlatform, id);
  }

  return { platformId, platform, platforms: SEARCH_PLATFORMS, setPlatform };
});
