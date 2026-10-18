<script setup lang="ts">
import { computed, onMounted } from 'vue';
import DataSourceBadge from '@/components/ui/DataSourceBadge.vue';
import TileFrame from '@/components/ui/TileFrame.vue';
import { useToastStore } from '@/stores/useToastStore';
import { useUiStore } from '@/stores/useUiStore';
import { useUsageStore } from '@/stores/useUsageStore';
import { formatInteger, formatPercent, formatTokens, formatUsd } from '@/utils/format';
import { formatRelativeFromSeconds } from '@/utils/time';

const store = useUsageStore();
const toast = useToastStore();
const ui = useUiStore();

/** 滚轮调节跨度：节流，否则一次滑动会直接冲过所有档位 */
let lastSpanStepAt = 0;
const SPAN_STEP_INTERVAL_MS = 180;

function onWheel(event: WheelEvent): void {
  const now = Date.now();
  if (now - lastSpanStepAt < SPAN_STEP_INTERVAL_MS) return;
  lastSpanStepAt = now;
  // 向上滚 = 拉近看细节（跨度变短），向下滚 = 拉远看趋势
  store.stepSpan(event.deltaY < 0 ? -1 : 1);
}

const barCount = computed(() => store.view?.bars.length ?? 24);

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
    site-url="https://commandcode.ai"
    site-label="Command Code 官网"
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
      <div class="usage-timeline__head">
        <span class="metric-label">USAGE_TIMELINE ({{ store.view?.spanLabel ?? '—' }}):</span>
        <span class="usage-timeline__hint" title="在图表上滚动滚轮可调节时间跨度">
          [滚轮调节跨度]
        </span>
      </div>
      <div
        class="usage-timeline__chart"
        :style="{ gridTemplateColumns: `repeat(${barCount}, minmax(0, 1fr))` }"
        role="img"
        :aria-label="`按${store.view?.spanLabel ?? ''}聚合的 token 用量柱状图，在图上滚动滚轮可切换跨度`"
        @wheel.prevent="onWheel"
      >
        <div
          v-for="bar in store.view?.bars ?? []"
          :key="bar.label"
          class="usage-timeline__col"
          :class="{ 'usage-timeline__col--now': bar.isCurrent }"
          :title="`${bar.label} · ${formatTokens(bar.tokens)} tokens`"
        >
          <div
            class="usage-timeline__fill"
            :style="{ height: `${bar.tokens > 0 ? Math.max(4, bar.height) : 0}%` }"
          ></div>
        </div>
      </div>
      <div class="usage-timeline__scale">
        <span>{{ store.view?.bars[0]?.label ?? '--' }}</span>
        <span>窗口内：{{ store.view ? formatTokens(store.view.windowTokens) : '—' }}</span>
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
      <span>
        SYNCED: {{ generatedLabel }} · KEY: {{ store.hasApiKey ? 'SET' : 'UNSET' }}
      </span>
      <span class="usage-actions">
        <button type="button" class="text-link" @click="ui.openSettings()">[CONFIG]</button>
        <button
          type="button"
          class="text-link text-link--purple"
          :disabled="store.isBusy"
          @click="refresh"
        >
          {{ store.isBusy ? '[LOADING...]' : '[REFRESH]' }}
        </button>
      </span>
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

.usage-timeline__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-2);
}

.usage-timeline__hint {
  font-size: 0.5625rem;
  color: var(--text-faint);
}

.usage-timeline__chart {
  display: grid;
  /* 列数由当前跨度决定，走内联样式覆盖 */
  grid-template-columns: repeat(24, minmax(0, 1fr));
  gap: 2px;
  align-items: end;
  height: 4rem;
  padding: var(--space-1);
  background: var(--bg-sunken);
  border: 1px solid var(--border);
  /* 滚轮由组件接管，避免误触页面滚动 */
  overscroll-behavior: contain;
}

.usage-timeline__col {
  display: flex;
  align-items: flex-end;
  height: 100%;
  min-width: 0;
  /* 空时段也要看得出「这里是时间轴的一格」 */
  background: var(--track-soft);
}

.usage-timeline__fill {
  width: 100%;
  background: var(--accent-purple);
  border-top: 1px solid var(--accent-purple);
}

.usage-timeline__col--now {
  background: var(--track-strong);
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

.usage-actions {
  display: inline-flex;
  flex-wrap: wrap;
  gap: var(--space-3);
}
</style>
