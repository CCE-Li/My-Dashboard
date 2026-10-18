<script setup lang="ts">
import { computed, onMounted } from 'vue';
import DataSourceBadge from '@/components/ui/DataSourceBadge.vue';
import PixelBar from '@/components/ui/PixelBar.vue';
import StatBlock from '@/components/ui/StatBlock.vue';
import TileFrame from '@/components/ui/TileFrame.vue';
import { APP_CONFIG } from '@/config/app.config';
import { useBrzStore } from '@/stores/useBrzStore';
import { useToastStore } from '@/stores/useToastStore';
import { useUiStore } from '@/stores/useUiStore';
import { formatCents, formatInteger, formatPercent } from '@/utils/format';
import { formatIsoLocal } from '@/utils/time';

const store = useBrzStore();
const toast = useToastStore();
const ui = useUiStore();

/** BRZ-Fund 应用地址，取自集中配置 */
const appUrl = APP_CONFIG.brzFund.appUrl;

const snapshot = computed(() => store.snapshot);

const sourceLabel = computed(() => {
  if (snapshot.value?.origin === 'indexeddb') return 'BRZ-FUND: 同源直读';
  if (snapshot.value?.origin === 'backup') return 'BRZ-FUND: 导入快照';
  return 'BRZ-FUND: 未接入';
});

const deadlineLabel = computed(() => {
  const days = snapshot.value?.daysToDeadline;
  if (days === null || days === undefined) return '未设置截止日';
  if (days > 0) return `距截止日 ${formatInteger(days)} 天`;
  if (days === 0) return '今天到期';
  return `已过期 ${formatInteger(Math.abs(days))} 天`;
});

const gapLabel = computed(() =>
  snapshot.value ? formatCents(snapshot.value.gap, snapshot.value.currency) : '—',
);

async function refresh(): Promise<void> {
  await store.load();
  if (snapshot.value?.origin === 'indexeddb') {
    toast.push('BRZ_FUND_RELOADED: 已从 brz-fund 读取最新数据');
  } else if (store.unavailable) {
    toast.push('BRZ_FUND_UNAVAILABLE: 已退化为导入快照');
  }
}

onMounted(() => {
  void store.load();
});
</script>

<template>
  <TileFrame
    tile-id="brz"
    title="BRZ_BUDGET_TRACKER"
    accent="var(--accent)"
    edge="top"
    site-url="https://cce-li.github.io/BRZ-Fund/"
    site-label="BRZ-Fund 应用"
  >
    <template #meta>
      <DataSourceBadge :origin="store.origin" />
    </template>

    <template v-if="snapshot">
      <div class="brz-head">
        <span class="metric-label">SAVED_FUNDS:</span>
        <span class="brz-head__value">{{ formatCents(snapshot.fundBalance, snapshot.currency) }}</span>
      </div>

      <div class="brz-target">
        <span>TARGET_PRICE:</span>
        <span class="brz-target__value">{{
          formatCents(snapshot.targetTotal, snapshot.currency)
        }}</span>
      </div>

      <div class="brz-progress">
        <PixelBar :value="snapshot.progressPercent" />
        <div class="brz-progress__meta">
          <span
            >RATIO: <strong>{{ formatPercent(snapshot.progressPercent) }}</strong></span
          >
          <span>GAP: {{ gapLabel }}</span>
        </div>
      </div>

      <div class="brz-secondary">
        <StatBlock
          label="应急储备"
          :value="formatCents(snapshot.emergencyBalance, snapshot.currency)"
          tone="var(--accent-cyan)"
          :note="
            snapshot.emergencyTarget > 0
              ? `目标 ${formatCents(snapshot.emergencyTarget, snapshot.currency)}`
              : '未设置目标'
          "
        />
        <StatBlock
          label="本月净流入"
          :value="formatCents(snapshot.monthlyInflow, snapshot.currency)"
          tone="var(--accent)"
          note="转入购车基金的净额"
        />
      </div>

      <p class="brz-hint">
        未分配现金 {{ formatCents(snapshot.unallocatedBalance, snapshot.currency) }} ·
        {{ deadlineLabel }}<br />
        <span class="brz-hint__dim">
          {{ snapshot.goalName }} · 快照 {{ formatIsoLocal(snapshot.capturedAt) }}
        </span>
      </p>
    </template>

    <div v-else class="brz-empty">
      <p class="brz-empty__title">尚未接入 BRZ-Fund 数据</p>
      <p class="brz-empty__detail">
        {{ store.unavailable ?? '正在读取同源 IndexedDB…' }}
      </p>
      <button type="button" class="text-link" @click="ui.openSettings()">
        [去设置里导入备份]
      </button>
    </div>

    <template #footer>
      <span>{{ sourceLabel }}</span>
      <span class="brz-actions">
        <a class="text-link" :href="appUrl" title="打开 BRZ-Fund 管理账本">[BRZ-FUND ↗]</a>
        <button type="button" class="text-link" @click="ui.openSettings()">[CONFIG]</button>
        <button type="button" class="text-link" :disabled="store.isBusy" @click="refresh">
          {{ store.isBusy ? '[READING...]' : '[SYNC]' }}
        </button>
      </span>
    </template>
  </TileFrame>
</template>

<style scoped>
.brz-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}

.brz-head__value {
  font-family: var(--font-mono);
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-primary);
}

.brz-target {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  font-size: 0.75rem;
  color: var(--text-dim);
  margin-top: var(--space-1);
}

.brz-target__value {
  font-family: var(--font-mono);
  color: var(--text-body);
}

.brz-progress {
  margin-top: var(--space-3);
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.brz-progress__meta {
  display: flex;
  justify-content: space-between;
  font-size: 0.625rem;
  color: var(--text-faint);
  font-family: var(--font-mono);
}

.brz-progress__meta strong {
  color: var(--accent);
}

.brz-secondary {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-2);
  margin-top: var(--space-4);
}

.brz-hint {
  margin: var(--space-3) 0 0;
  font-size: 0.625rem;
  color: var(--text-dim);
  line-height: 1.6;
}

.brz-hint__dim {
  color: var(--text-faint);
}

.brz-empty {
  padding: var(--space-4) 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  align-items: flex-start;
}

.brz-empty__title {
  margin: 0;
  font-size: 0.75rem;
  color: var(--text-body);
  font-weight: 700;
}

.brz-empty__detail {
  margin: 0;
  font-size: 0.625rem;
  color: var(--text-dim);
  line-height: 1.6;
}

.brz-actions {
  display: inline-flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--space-3);
}

.brz-actions a {
  text-underline-offset: 2px;
}
</style>
