<script setup lang="ts">
import TileFrame from '@/components/ui/TileFrame.vue';

interface QuickTag {
  label: string;
  keyword: string;
}

const quickTags: readonly QuickTag[] = [
  { label: 'BRZ_MODS', keyword: 'SUBARU BRZ' },
  { label: 'CODEFORCES', keyword: 'Codeforces' },
  { label: 'CYBERPUNK', keyword: 'Cyberpunk' },
  { label: 'DEEPSEEK', keyword: 'DeepSeek' },
];

const SEARCH_ENDPOINT = 'https://search.bilibili.com/all';

function tagUrl(keyword: string): string {
  return `${SEARCH_ENDPOINT}?keyword=${encodeURIComponent(keyword)}`;
}
</script>

<template>
  <TileFrame
    tile-id="search"
    title="BEWLYCAT_BILIBILI_SEARCH_GATEWAY"
    edge="left"
    accent="var(--accent-pink)"
    meta="[ENDPOINT: SEARCH.BILIBILI.COM]"
  >
    <form
      :action="SEARCH_ENDPOINT"
      method="get"
      target="_blank"
      rel="noopener"
      class="search-form"
    >
      <input
        type="text"
        name="keyword"
        placeholder="ENTER SEARCH KEYWORD..."
        autofocus
        class="sharp-input search-form__input"
        aria-label="B 站搜索关键词"
      />
      <button type="submit" class="sharp-btn sharp-btn--pink search-form__submit">
        EXECUTE&nbsp;&crarr;
      </button>
    </form>

    <div class="quick-tags">
      <span class="quick-tags__label">QUICK_TAGS:</span>
      <a
        v-for="tag in quickTags"
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
