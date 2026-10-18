<script setup lang="ts">
import { computed } from 'vue';
import TileFrame from '@/components/ui/TileFrame.vue';
import { buildSearchUrl } from '@/config/searchPlatforms';
import { useSearchStore } from '@/stores/useSearchStore';
import { useUiStore } from '@/stores/useUiStore';

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

const search = useSearchStore();
const ui = useUiStore();
const platform = computed(() => search.platform);

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
    <div class="platform-bar">
      <span class="platform-bar__label">PLATFORM:</span>
      <span class="platform-bar__current">{{ platform.label }}</span>
      <button type="button" class="platform-bar__link" @click="ui.openSettings()">
        [CHANGE]
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
.platform-bar {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-3);
  font-size: 0.6875rem;
}

.platform-bar__label {
  color: var(--text-faint);
}

.platform-bar__current {
  color: var(--accent-pink);
  font-weight: 700;
  border: 1px solid var(--accent-pink);
  padding: 0.0625rem 0.25rem;
}

.platform-bar__link {
  background: none;
  border: none;
  padding: 0;
  font-family: inherit;
  font-size: inherit;
  letter-spacing: inherit;
  color: var(--text-dim);
  text-decoration: underline;
  cursor: pointer;
}

.platform-bar__link:hover {
  color: var(--accent-pink);
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
