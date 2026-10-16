<script setup lang="ts">
import { computed, ref } from 'vue';
import TileFrame from '@/components/ui/TileFrame.vue';
import {
  buildSearchUrl,
  DEFAULT_SEARCH_PLATFORM,
  getSearchPlatform,
  isSearchPlatformId,
  SEARCH_PLATFORMS,
  type SearchPlatformId,
} from '@/config/searchPlatforms';
import { readText, STORAGE_KEYS, writeText } from '@/services/storage';

interface QuickTag {
  label: string;
  keyword: string;
}

/** 这些关键词在任何平台上都讲得通，所以跟着所选平台一起走 */
const QUICK_TAGS: readonly QuickTag[] = [
  { label: 'BRZ_MODS', keyword: 'SUBARU BRZ' },
  { label: 'CODEFORCES', keyword: 'Codeforces' },
  { label: 'CYBERPUNK', keyword: 'Cyberpunk' },
  { label: 'DEEPSEEK', keyword: 'DeepSeek' },
];

const stored = readText(STORAGE_KEYS.searchPlatform, DEFAULT_SEARCH_PLATFORM);
const platformId = ref<SearchPlatformId>(
  isSearchPlatformId(stored) ? stored : DEFAULT_SEARCH_PLATFORM,
);

const platform = computed(() => getSearchPlatform(platformId.value));

function selectPlatform(id: SearchPlatformId): void {
  platformId.value = id;
  writeText(STORAGE_KEYS.searchPlatform, id);
}

function tagUrl(keyword: string): string {
  return buildSearchUrl(platform.value, keyword);
}
</script>

<template>
  <TileFrame
    tile-id="search"
    :title="`SEARCH_GATEWAY // ${platform.label}`"
    edge="left"
    accent="var(--accent-pink)"
    :meta="`[ENDPOINT: ${platform.searchEndpoint.replace('https://', '').toUpperCase()}]`"
    :site-url="platform.homeUrl"
    :site-label="`${platform.label} 官网`"
  >
    <div class="platform-picker">
      <span class="platform-picker__label">PLATFORM:</span>
      <button
        v-for="item in SEARCH_PLATFORMS"
        :key="item.id"
        type="button"
        class="platform-picker__option"
        :class="{ 'platform-picker__option--active': item.id === platformId }"
        :aria-pressed="item.id === platformId"
        :title="`改用 ${item.label} 搜索`"
        @click="selectPlatform(item.id)"
      >
        [{{ item.label }}]
      </button>
    </div>

    <form
      :action="platform.searchEndpoint"
      method="get"
      target="_blank"
      rel="noopener"
      class="search-form"
    >
      <input
        type="text"
        :name="platform.queryParam"
        :placeholder="`SEARCH ON ${platform.label}...`"
        autofocus
        class="sharp-input search-form__input"
        :aria-label="`${platform.label} 搜索关键词`"
      />
      <button type="submit" class="sharp-btn sharp-btn--pink search-form__submit">
        EXECUTE&nbsp;&crarr;
      </button>
    </form>

    <div class="quick-tags">
      <span class="quick-tags__label">QUICK_TAGS:</span>
      <a
        v-for="tag in QUICK_TAGS"
        :key="tag.label"
        :href="tagUrl(tag.keyword)"
        target="_blank"
        rel="noopener"
        class="quick-tags__link"
      >
        [{{ tag.label }}]
      </a>
    </div>
  </TileFrame>
</template>

<style scoped>
.platform-picker {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-1);
  margin-bottom: var(--space-3);
  font-size: 0.6875rem;
}

.platform-picker__label {
  color: var(--text-faint);
  margin-right: var(--space-1);
}

.platform-picker__option {
  background: none;
  border: 1px solid transparent;
  color: var(--text-dim);
  font-family: inherit;
  font-size: inherit;
  letter-spacing: inherit;
  padding: 0.125rem 0.25rem;
  cursor: pointer;
  transition:
    color var(--transition-instant),
    border-color var(--transition-instant);
}

.platform-picker__option:hover {
  color: var(--accent-pink);
  border-color: var(--border-strong);
}

.platform-picker__option--active {
  color: var(--accent-pink);
  border-color: var(--accent-pink);
  font-weight: 700;
}

.search-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

@media (min-width: 640px) {
  .search-form {
    flex-direction: row;
  }
}

.search-form__input {
  flex: 1;
  padding: var(--space-3);
  font-size: 0.875rem;
  letter-spacing: var(--tracking-wide);
}

.search-form__submit {
  padding: var(--space-3) var(--space-6);
  font-size: 0.75rem;
  letter-spacing: var(--tracking-wide);
}

.quick-tags {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
  margin-top: var(--space-3);
  font-size: 0.6875rem;
  color: var(--text-dim);
}

.quick-tags__label {
  color: var(--text-faint);
}

.quick-tags__link {
  color: inherit;
  text-decoration: underline;
}

.quick-tags__link:hover {
  color: var(--accent-pink);
}
</style>
