<script setup lang="ts">
import { computed, onMounted } from 'vue';
import DataSourceBadge from '@/components/ui/DataSourceBadge.vue';
import PixelBar from '@/components/ui/PixelBar.vue';
import StatBlock from '@/components/ui/StatBlock.vue';
import TileFrame from '@/components/ui/TileFrame.vue';
import { formatBytes, formatUptime, severityOf } from '@/domain/server';
import { useServerStore } from '@/stores/useServerStore';
import { useToastStore } from '@/stores/useToastStore';
import { useUiStore } from '@/stores/useUiStore';
import { formatPercent } from '@/utils/format';
import { formatRelativeFromSeconds } from '@/utils/time';

const store = useServerStore();
const toast = useToastStore();
const ui = useUiStore();

const view = computed(() => store.view);

const origin = computed(() => {
  if (store.state === 'ready') return 'live';
  if (store.state === 'error') return 'empty';
  return store.isConfigured ? 'cached' : 'empty';
});

const syncedLabel = computed(() =>
  store.fetchedAt ? formatRelativeFromSeconds(Math.floor(store.fetchedAt / 1000)) : 'NOT_SYNCED',
);

const loadLabel = computed(() => {
  const loads = view.value?.loadAvg ?? [];
  return loads.length > 0 ? loads.map((value) => value.toFixed(2)).join(' / ') : '—';
});

const SEVERITY_COLOR: Record<string, string> = {
  ok: 'var(--accent)',
  warn: 'var(--warn)',
  critical: 'var(--accent-pink)',
};

/** 占用率越高越告警：绿 → 黄 → 粉，与配额进度条同口径 */
function toneOf(percent: number): string {
  return SEVERITY_COLOR[severityOf(percent)] ?? 'var(--accent)';
}

async function sync(): Promise<void> {
  await store.sync();
  toast.push(
    store.state === 'ready'
      ? 'SERVER_SYNCED: 服务器指标已刷新'
      : `SERVER_SYNC_FAILED: ${store.error ?? '未知错误'}`,
  );
}

onMounted(() => {
  void store.sync();
});
</script>

<template>
  <TileFrame tile-id="server" title="SERVER_STATUS" accent="var(--accent-cyan)" edge="top">
    <template #meta>
      <span class="sv-meta">
        <DataSourceBadge :origin="origin" />
        <span v-if="view">{{ view.hostname }}</span>
      </span>
    </template>

    <template v-if="view">
      <div class="sv-summary">
        <StatBlock
          label="运行时长"
          :value="formatUptime(view.uptimeSec)"
          tone="var(--accent-cyan)"
          :note="view.platform"
        />
        <StatBlock
          label="负载 1/5/15"
          :value="loadLabel"
          :note="`${view.cores} 核`"
        />
      </div>

      <div class="sv-metrics">
        <div class="sv-metric">
          <div class="sv-metric__head">
            <span class="metric-label">CPU</span>
            <span class="sv-metric__value" :style="{ color: toneOf(view.cpuPercent) }">
              {{ formatPercent(view.cpuPercent) }}
            </span>
          </div>
          <PixelBar :value="view.cpuPercent" :color="toneOf(view.cpuPercent)" />
        </div>

        <div class="sv-metric">
          <div class="sv-metric__head">
            <span class="metric-label">MEMORY</span>
            <span class="sv-metric__value" :style="{ color: toneOf(view.memoryPercent) }">
              {{ formatBytes(view.memoryUsedBytes) }} / {{ formatBytes(view.memoryTotalBytes) }}
            </span>
          </div>
          <PixelBar :value="view.memoryPercent" :color="toneOf(view.memoryPercent)" />
        </div>

        <div v-if="view.disk" class="sv-metric">
          <div class="sv-metric__head">
            <span class="metric-label">DISK {{ view.disk.mount }}</span>
            <span class="sv-metric__value" :style="{ color: toneOf(view.disk.percent) }">
              {{ formatBytes(view.disk.usedBytes) }} / {{ formatBytes(view.disk.totalBytes) }}
            </span>
          </div>
          <PixelBar :value="view.disk.percent" :color="toneOf(view.disk.percent)" />
        </div>
      </div>
    </template>

    <p v-else-if="store.error" class="sv-hint sv-hint--warn">
      {{ store.error }}
      <button type="button" class="text-link" @click="ui.openTileSettings('server')">[去设置]</button>
    </p>

    <p v-else-if="!store.isConfigured" class="sv-hint">
      未配置指标端点。
      <button type="button" class="text-link" @click="ui.openTileSettings('server')">[去设置]</button>
    </p>

    <p v-else class="sv-hint">正在读取…</p>

    <template #footer>
      <span>
        SYNCED: {{ syncedLabel }}
        <template v-if="view?.generatedAt"> · {{ view.generatedAt }}</template>
      </span>
      <span class="sv-actions">
        <button type="button" class="text-link" @click="ui.openTileSettings('server')">[CONFIG]</button>
        <button type="button" class="text-link" :disabled="store.isBusy" @click="sync">
          {{ store.isBusy ? '[SYNCING...]' : '[SYNC]' }}
        </button>
      </span>
    </template>
  </TileFrame>
</template>

<style scoped>
.sv-meta {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
}

.sv-summary {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-2);
  margin-bottom: var(--space-3);
}

.sv-metrics {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.sv-metric__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-2);
  margin-bottom: var(--space-1);
}

.sv-metric__value {
  font-family: var(--font-mono);
  font-size: 0.6875rem;
}

.sv-hint {
  margin: var(--space-3) 0 0;
  font-size: 0.625rem;
  color: var(--text-dim);
  line-height: 1.6;
}

.sv-hint--warn {
  color: var(--accent-pink);
  border-left: 2px solid var(--accent-pink);
  padding-left: var(--space-2);
}

.sv-actions {
  display: inline-flex;
  gap: var(--space-3);
}
</style>
