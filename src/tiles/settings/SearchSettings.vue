<script setup lang="ts">
import { useSearchStore } from '@/stores/useSearchStore';

const searchStore = useSearchStore();
</script>

<template>
  <section class="settings-group">
    <h3 class="settings-group__title">搜索平台 / SEARCH</h3>
    <div class="option-row">
      <button
        v-for="item in searchStore.platforms"
        :key="item.id"
        type="button"
        class="option-chip"
        :class="{ 'option-chip--active': item.id === searchStore.platformId }"
        :aria-pressed="item.id === searchStore.platformId"
        @click="searchStore.setPlatform(item.id)"
      >
        [{{ item.label }}]
      </button>
    </div>
    <p class="settings-hint">表单会提交到该平台的结果页，关键词参数自动适配。</p>
  </section>
</template>
