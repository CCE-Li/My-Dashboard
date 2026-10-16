<script setup lang="ts">
import { computed, onMounted } from 'vue';
import DataSourceBadge from '@/components/ui/DataSourceBadge.vue';
import TileFrame from '@/components/ui/TileFrame.vue';
import { useToastStore } from '@/stores/useToastStore';
import { useUsageStore } from '@/stores/useUsageStore';
import { formatInteger, formatPercent, formatTokens, formatUsd } from '@/utils/format';
import { formatRelativeFromSeconds } from '@/utils/time';

const store = useUsageStore();
const toast = useToastStore();

const origin = computed(() => (store.view ? 'live' : 'empty'));

const generatedLabel = computed(() => {
  if (!store.view?.generatedAt) return 'NOT_SYNCED';
  const seconds = Math.floor(new Date(store.view.generatedAt).getTime() / 1000);
  return Number.isFinite(seconds) ? formatRelativeFromSeconds(seconds) : 'NOT_SYNCED';
});

async function refresh(): Promise<void> {
  await store.load();
  if (store.state === 'ready') {
    toast.push('USAGE_REFRESHED: 已重新读取用量快照');
  } else {
    toast.push(`USAGE_REFRESH_FAILED: ${store.error ?? '未知错误'}`);
  }
}

onMounted(() => {
  void store.load();
});
</script>

<template>
  <TileFrame
    tile-id="usage"
    title="API_TOKEN_MONITOR"
    accent="var(--accent-purple)"
    edge="top"
  >
    <template #meta>
      <DataSourceBadge :origin="origin" label="SNAPSHOT" />
    </template>

    <div class="usage-head">
      <span class="metric-label">TOTAL_TOKENS:</span>
      <span class="usage-head__value">{{
        store.view ? formatTokens(store.view.totalTokens) : '—'
      }}</span>
    </div>

    <div class="usage-timeline">
      <div class="metric-label">USAGE_TIMELINE (24H):</div>
      <div class="usage-timeline__chart" role="img" aria-label="近 24 小时 token 用量柱状图">
        <div
          v-for="bar in store.view?.hourly ?? []"
          :key="bar.label"
          class="usage-timeline__col"
          :class="{ 'usage-timeline__col--now': bar.isCurrentHour }"
          :title="`${bar.label}:00 · ${formatTokens(bar.tokens)} tokens`"
        >
          <div
            class="usage-timeline__fill"
            :style="{ height: `${bar.tokens > 0 ? Math.max(4, bar.height) : 0}%` }"
          ></div>
        </div>
      </div>
      <div class="usage-timeline__scale">
        <span>{{ store.view?.hourly[0]?.label ?? '--' }}:00</span>
        <span>近 24h：{{ store.view ? formatTokens(store.view.hourlyTokens) : '—' }}</span>
        <span>现在</span>
      </div>
    </div>

    <dl v-if="store.view" class="usage-stats">
      <div>
        <dt>REQUESTS</dt>
        <dd>{{ formatInteger(store.view.requests) }}</dd>
      </div>
      <div>
        <dt>COST</dt>
        <dd>{{ formatUsd(store.view.costUsd) }}</dd>
      </div>
      <div>
        <dt>CACHE_HIT</dt>
        <dd>{{ formatPercent(store.view.cacheHitRate) }}</dd>
      </div>
      <div>
        <dt>OUTPUT</dt>
        <dd>{{ formatTokens(store.view.outputTokens) }}</dd>
      </div>
    </dl>

    <p v-if="store.state === 'error'" class="usage-error">
      {{ store.error }}<br />
      <span class="usage-error__hint">{{ store.hint }}</span>
    </p>

    <template #footer>
      <span>SYNCED: {{ generatedLabel }}</span>
      <button
        type="button"
        class="text-link text-link--purple"
        :disabled="store.isBusy"
        @click="refresh"
      >
        {{ store.isBusy ? '[LOADING...]' : '[REFRESH]' }}
      </button>
    </template>
  </TileFrame>
</template>

<style scoped>
.usage-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: var(--space-3);
}

.usage-head__value {
  font-family: var(--font-mono);
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-primary);
}

.usage-timeline {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.usage-timeline__chart {
  display: grid;
  grid-template-columns: repeat(24, minmax(0, 1fr));
  gap: 2px;
  align-items: end;
  height: 4rem;
  padding: var(--space-1);
  background: var(--bg-sunken);
  border: 1px solid var(--border);
}

.usage-timeline__col {
  display: flex;
  align-items: flex-end;
  height: 100%;
  min-width: 0;
  /* 空时段也要看得出「这里是时间轴的一格」 */
  background: rgba(168, 85, 247, 0.07);
}

.usage-timeline__fill {
  width: 100%;
  background: var(--accent-purple);
  border-top: 1px solid var(--accent-purple);
}

.usage-timeline__col--now {
  background: rgba(168, 85, 247, 0.18);
}

.usage-timeline__col--now .usage-timeline__fill {
  box-shadow: 0 0 6px var(--accent-purple);
}

.usage-timeline__scale {
  display: flex;
  justify-content: space-between;
  font-size: 0.5625rem;
  color: var(--text-faint);
  font-family: var(--font-mono);
}

.usage-stats {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-2);
  margin: var(--space-3) 0 0;
}

.usage-stats dt {
  font-size: 0.5625rem;
  color: var(--text-faint);
}

.usage-stats dd {
  margin: 0;
  font-family: var(--font-mono);
  font-size: 0.8125rem;
  font-weight: 700;
  color: var(--text-body);
}

.usage-error {
  margin: var(--space-3) 0 0;
  font-size: 0.625rem;
  color: var(--accent-pink);
  line-height: 1.5;
}

.usage-error__hint {
  color: var(--text-dim);
}
</style>
