<script setup lang="ts">
import { computed } from 'vue';
import { useCodeforcesStore } from '@/stores/useCodeforcesStore';
import { useLayoutStore } from '@/stores/useLayoutStore';
import { useUsageStore } from '@/stores/useUsageStore';
import { TILE_IDS } from '@/tiles/registry';
import { formatRelativeFromSeconds } from '@/utils/time';

const layout = useLayoutStore();
const usage = useUsageStore();
const codeforces = useCodeforcesStore();

const usageSyncLabel = computed(() => {
  if (usage.state === 'error') return 'SYNC_FAILED';
  const generatedAt = usage.view?.generatedAt;
  if (!generatedAt) return 'NOT_SYNCED';
  const seconds = Math.floor(new Date(generatedAt).getTime() / 1000);
  return Number.isFinite(seconds) ? formatRelativeFromSeconds(seconds) : 'NOT_SYNCED';
});

const cfLabel = computed(() => {
  if (!codeforces.isConfigured) return 'NOT_CONFIGURED';
  if (codeforces.state === 'error') return 'SYNC_ERROR';
  if (codeforces.state === 'loading') return 'SYNCING';
  return codeforces.stats ? 'OK' : 'IDLE';
});
</script>

<template>
  <footer class="app-footer shell__block">
    <div>
      TIP: 拖动磁贴标题左侧的 <strong>[::]</strong> 手柄可调整顺序，布局保存在本机浏览器。
    </div>
    <div class="app-footer__stats">
      <span>TILES: {{ TILE_IDS.length }}</span>
      <span>LAYOUT: {{ layout.isCustomised ? 'CUSTOM' : 'DEFAULT' }}</span>
      <span>USAGE_SYNC: {{ usageSyncLabel }}</span>
      <span>CF: {{ cfLabel }}</span>
    </div>
  </footer>
</template>

<style scoped>
.app-footer {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: var(--space-2);
  border-top: 1px solid var(--border);
  padding-top: var(--space-4);
  font-size: 0.625rem;
  color: var(--text-faint);
}

@media (min-width: 640px) {
  .app-footer {
    flex-direction: row;
  }
}

.app-footer__stats {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-4);
  font-family: var(--font-mono);
}
</style>
