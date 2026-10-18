<script setup lang="ts">
import { computed, onMounted } from 'vue';
import DataSourceBadge from '@/components/ui/DataSourceBadge.vue';
import StatBlock from '@/components/ui/StatBlock.vue';
import TileFrame from '@/components/ui/TileFrame.vue';
import { APP_CONFIG } from '@/config/app.config';
import { normalizeHandle } from '@/services/codeforcesApi';
import { useCodeforcesStore } from '@/stores/useCodeforcesStore';
import { useToastStore } from '@/stores/useToastStore';
import { useUiStore } from '@/stores/useUiStore';
import { formatInteger, formatRank } from '@/utils/format';
import { formatRelativeFromSeconds } from '@/utils/time';

const store = useCodeforcesStore();
const toast = useToastStore();
const ui = useUiStore();

const displayHandle = computed(() => {
  const normalized = normalizeHandle(store.handle);
  return normalized ? `@${normalized}` : '未配置';
});

const origin = computed(() => (store.stats ? 'live' : 'empty'));

const activityMax = computed(() =>
  (store.stats?.activity ?? []).reduce((max, day) => Math.max(max, day.submissions), 0),
);

const activityDays = computed(
  () => store.stats?.activity.length ?? APP_CONFIG.codeforces.activityDays,
);

const syncLabel = computed(() => {
  if (!store.isConfigured) return 'SYNC: 未配置';
  if (store.state === 'loading') return 'SYNC: SYNCING...';
  if (store.state === 'error') return 'SYNC: FAILED';
  if (store.stats) return `SYNC: ${formatRelativeFromSeconds(store.stats.fetchedAt)}`;
  return 'SYNC: IDLE';
});

const solvedNote = computed(() =>
  store.stats ? `窗口内 ${formatInteger(store.stats.windowSize)} 次提交` : '',
);

async function sync(): Promise<void> {
  await store.sync(true);
  if (store.state === 'ready') {
    toast.push('CF_API_SYNCED: 数据已刷新');
  } else if (store.state === 'error') {
    toast.push(`CF_SYNC_FAILED: ${store.error ?? '未知错误'}`);
  }
}

onMounted(() => {
  void store.sync();
});
</script>

<template>
  <TileFrame
    tile-id="codeforces"
    title="CODEFORCES_STATUS"
    accent="var(--accent-cyan)"
    edge="top"
    site-url="https://codeforces.com"
    site-label="Codeforces 官网"
  >
    <template #meta>
      <span class="cf-meta">
        <DataSourceBadge :origin="origin" />
        <span>{{ displayHandle }}</span>
      </span>
    </template>

    <div class="cf-stats">
      <StatBlock
        label="RATING"
        :value="store.stats?.rating != null ? String(store.stats.rating) : '—'"
        tone="var(--accent-cyan)"
        :note="formatRank(store.stats?.rank ?? null)"
      />
      <StatBlock
        label="SOLVED"
        :value="store.stats ? formatInteger(store.stats.solvedInWindow) : '—'"
        tone="var(--accent)"
        :note="solvedNote"
      />
    </div>

    <div class="cf-activity">
      <div class="metric-label">SUBMISSION_ACTIVITY ({{ activityDays }}D):</div>
      <div class="cf-activity__bar">
        <div
          v-for="day in store.stats?.activity ?? []"
          :key="day.day"
          class="cf-activity__cell"
          :style="{
            opacity: activityMax > 0 ? Math.max(0.12, day.submissions / activityMax) : 0.12,
          }"
          :title="`${day.day}：${day.submissions} 次提交 / ${day.accepted} 次通过`"
        ></div>
        <div v-if="!store.stats" class="cf-activity__empty">等待同步…</div>
      </div>
    </div>

    <p v-if="store.stats" class="cf-hint">
      本月新增通过 <strong>{{ formatInteger(store.stats.solvedThisMonth) }}</strong> 题 · 最高分
      {{ store.stats.maxRating ?? '—' }} · 最近提交
      {{ formatRelativeFromSeconds(store.stats.lastSubmissionAt) }}
    </p>

    <p v-if="!store.isConfigured" class="cf-hint">
      还没有设置 handle。
      <button type="button" class="text-link" @click="ui.openSettings()">[去设置里填写]</button>
    </p>

    <p v-if="store.error" class="cf-error">{{ store.error }}</p>

    <template #footer>
      <span>{{ syncLabel }}</span>
      <span class="cf-actions">
        <button type="button" class="text-link" @click="ui.openSettings()">[CONFIG]</button>
        <button
          type="button"
          class="text-link text-link--cyan"
          :disabled="store.isBusy"
          @click="sync"
        >
          {{ store.isBusy ? '[SYNCING...]' : '[SYNC_API]' }}
        </button>
      </span>
    </template>
  </TileFrame>
</template>

<style scoped>
.cf-meta {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
}

.cf-stats {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-2);
  margin-bottom: var(--space-3);
}

.cf-activity {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.cf-activity__bar {
  display: flex;
  align-items: stretch;
  gap: 2px;
  height: 0.75rem;
  position: relative;
}

.cf-activity__cell {
  flex: 1;
  background: var(--accent-cyan);
  min-width: 2px;
}

.cf-activity__empty {
  font-size: 0.625rem;
  color: var(--text-faint);
  line-height: 0.75rem;
}

.cf-hint {
  margin: var(--space-3) 0 0;
  font-size: 0.625rem;
  color: var(--text-dim);
  line-height: 1.5;
}

.cf-hint strong {
  color: var(--accent);
}

.cf-error {
  margin: var(--space-3) 0 0;
  font-size: 0.625rem;
  color: var(--accent-pink);
  border-left: 2px solid var(--accent-pink);
  padding-left: var(--space-2);
  line-height: 1.5;
}

.cf-actions {
  display: inline-flex;
  gap: var(--space-3);
}
</style>
