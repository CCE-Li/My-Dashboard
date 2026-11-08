<script setup lang="ts">
import { computed, onMounted } from 'vue';
import DataSourceBadge from '@/components/ui/DataSourceBadge.vue';
import StatBlock from '@/components/ui/StatBlock.vue';
import TileFrame from '@/components/ui/TileFrame.vue';
import type { NapcatHealth } from '@/types/napcat';
import { useNapcatStore } from '@/stores/useNapcatStore';
import { useToastStore } from '@/stores/useToastStore';
import { useUiStore } from '@/stores/useUiStore';
import { formatInteger } from '@/utils/format';
import { formatRelativeFromSeconds } from '@/utils/time';

const NAPCAT_SITE = 'https://github.com/NapNeko/NapCatQQ';

const store = useNapcatStore();
const toast = useToastStore();
const ui = useUiStore();

const view = computed(() => store.view);

const HEALTH_PRESET: Record<NapcatHealth, { text: string; color: string }> = {
  online: { text: 'ONLINE', color: 'var(--accent)' },
  degraded: { text: 'DEGRADED', color: 'var(--warn)' },
  offline: { text: 'OFFLINE', color: 'var(--accent-pink)' },
};

const health = computed(() => HEALTH_PRESET[store.health]);

const origin = computed(() => {
  if (store.state === 'ready') return 'live';
  if (store.state === 'error') return 'empty';
  return 'cached';
});

const syncedLabel = computed(() =>
  store.fetchedAt ? formatRelativeFromSeconds(Math.floor(store.fetchedAt / 1000)) : 'NOT_SYNCED',
);

const avatarChar = computed(() => view.value?.nickname.trim().slice(0, 1) || '?' );

async function sync(): Promise<void> {
  await store.sync();
  toast.push(
    store.state === 'ready'
      ? 'NAPCAT_SYNCED: Bot 状态已刷新'
      : `NAPCAT_SYNC_FAILED: ${store.error ?? '未知错误'}`,
  );
}

onMounted(() => {
  void store.sync();
});
</script>

<template>
  <TileFrame
    tile-id="napcat"
    title="NAPCAT_BOT"
    accent="var(--accent-purple)"
    edge="top"
    :site-url="NAPCAT_SITE"
    site-label="NapCatQQ 仓库"
  >
    <template #meta>
      <span class="nc-meta">
        <DataSourceBadge :origin="origin" />
        <span :style="{ color: health.color }">[{{ health.text }}]</span>
      </span>
    </template>

    <template v-if="view">
      <div class="nc-identity">
        <div class="nc-avatar" aria-hidden="true">{{ avatarChar }}</div>
        <div class="nc-identity__text">
          <div class="nc-name">{{ view.nickname }}</div>
          <div class="nc-uin">UIN {{ view.uin || '—' }}</div>
        </div>
      </div>

      <div class="nc-summary">
        <StatBlock
          label="好友"
          :value="formatInteger(view.friendCount)"
          tone="var(--accent-purple)"
        />
        <StatBlock
          label="群聊"
          :value="formatInteger(view.groupCount)"
          tone="var(--accent-cyan)"
        />
      </div>

      <div class="nc-version">
        <span class="metric-label">VERSION:</span>
        <span>{{ view.appName }} {{ view.appVersion }}</span>
        <span class="nc-proto">OneBot {{ view.protocolVersion }}</span>
      </div>
    </template>

    <p v-else-if="store.error" class="nc-hint nc-hint--warn">
      {{ store.error }}
      <button type="button" class="text-link" @click="ui.openTileSettings('napcat')">[去设置]</button>
    </p>

    <p v-else class="nc-hint">正在连接 NapCat…</p>

    <template #footer>
      <span>
        SYNCED: {{ syncedLabel }}
        <template v-if="store.hasToken"> · TOKEN {{ store.maskedToken }}</template>
      </span>
      <span class="nc-actions">
        <button type="button" class="text-link" @click="ui.openTileSettings('napcat')">[CONFIG]</button>
        <button type="button" class="text-link" :disabled="store.isBusy" @click="sync">
          {{ store.isBusy ? '[SYNCING...]' : '[SYNC]' }}
        </button>
      </span>
    </template>
  </TileFrame>
</template>

<style scoped>
.nc-meta {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
}

.nc-identity {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin-bottom: var(--space-3);
}

.nc-avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  flex-shrink: 0;
  border: 1px solid var(--accent-purple);
  color: var(--accent-purple);
  font-size: 1rem;
  font-weight: 700;
}

.nc-identity__text {
  min-width: 0;
}

.nc-name {
  color: var(--text-primary);
  font-weight: 700;
  font-size: 0.8125rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.nc-uin {
  margin-top: 0.125rem;
  font-family: var(--font-mono);
  font-size: 0.625rem;
  color: var(--text-faint);
}

.nc-summary {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-2);
}

.nc-version {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: var(--space-2);
  margin-top: var(--space-3);
  padding-top: var(--space-3);
  border-top: 1px solid var(--border-subtle);
  font-family: var(--font-mono);
  font-size: 0.625rem;
  color: var(--text-dim);
}

.nc-proto {
  color: var(--text-faint);
}

.nc-hint {
  margin: var(--space-3) 0 0;
  font-size: 0.625rem;
  color: var(--text-dim);
  line-height: 1.6;
}

.nc-hint--warn {
  color: var(--accent-pink);
  border-left: 2px solid var(--accent-pink);
  padding-left: var(--space-2);
}

.nc-actions {
  display: inline-flex;
  gap: var(--space-3);
}
</style>
