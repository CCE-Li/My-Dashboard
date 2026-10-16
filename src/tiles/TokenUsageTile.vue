<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import DataSourceBadge from '@/components/ui/DataSourceBadge.vue';
import TileFrame from '@/components/ui/TileFrame.vue';
import { useToastStore } from '@/stores/useToastStore';
import { useUsageStore } from '@/stores/useUsageStore';
import { formatInteger, formatPercent, formatTokens, formatUsd } from '@/utils/format';
import { formatRelativeFromSeconds } from '@/utils/time';

const store = useUsageStore();
const toast = useToastStore();

const showConfig = ref(false);
const reveal = ref(false);
const draft = ref(store.apiKey);

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

const checkTone = computed(() => {
  switch (store.keyCheck?.status) {
    case 'valid':
      return 'var(--accent)';
    case 'invalid':
      return 'var(--accent-pink)';
    case 'no-access':
      return 'var(--warn)';
    default:
      return 'var(--text-dim)';
  }
});

async function refresh(): Promise<void> {
  await store.load();
  if (store.state === 'ready') {
    toast.push('USAGE_REFRESHED: 已重新读取用量快照');
  } else {
    toast.push(`USAGE_REFRESH_FAILED: ${store.error ?? '未知错误'}`);
  }
}

function toggleConfig(): void {
  showConfig.value = !showConfig.value;
  draft.value = store.apiKey;
  reveal.value = false;
}

function saveKey(): void {
  if (!draft.value.trim()) {
    toast.push('API_KEY_EMPTY: 请输入 API key');
    return;
  }
  store.saveApiKey(draft.value);
  draft.value = store.apiKey;
  toast.push('API_KEY_SAVED: 已保存到本机 localStorage');
}

async function testKey(): Promise<void> {
  await store.checkApiKey();
  const status = store.keyCheck?.status;
  if (status === 'valid') {
    toast.push('API_KEY_VALID: 鉴权通过');
  } else {
    toast.push(`API_KEY_CHECK: ${store.keyCheck?.detail ?? '未知结果'}`);
  }
}

function clearKey(): void {
  store.clearApiKey();
  draft.value = '';
  toast.push('API_KEY_CLEARED: 已从本机移除');
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

    <div v-if="showConfig" class="usage-config">
      <div class="usage-config__head">
        <span class="metric-label">API_KEY:</span>
        <span v-if="store.hasApiKey" class="usage-config__masked">{{ store.maskedApiKey }}</span>
        <span v-else class="usage-config__none">未配置</span>
      </div>

      <input
        id="cc-api-key-input"
        v-model="draft"
        class="sharp-input"
        :type="reveal ? 'text' : 'password'"
        placeholder="user_..."
        autocomplete="off"
        spellcheck="false"
        aria-label="Command Code API key"
      />

      <label class="usage-config__reveal">
        <input v-model="reveal" type="checkbox" />
        <span>显示明文</span>
      </label>

      <div class="usage-config__actions">
        <button type="button" class="sharp-btn" @click="saveKey">SAVE</button>
        <button
          type="button"
          class="sharp-btn"
          :disabled="!store.hasApiKey || store.checkingKey"
          @click="testKey"
        >
          {{ store.checkingKey ? 'TESTING...' : 'TEST' }}
        </button>
        <button v-if="store.hasApiKey" type="button" class="sharp-btn" @click="clearKey">
          CLEAR
        </button>
      </div>

      <p v-if="store.keyCheck" class="usage-config__result" :style="{ color: checkTone }">
        &gt; {{ store.keyCheck.detail }}
      </p>

      <p class="usage-config__note">
        key 只写入本机 localStorage（<code>mydash:v1:command-code-api-key</code>），
        不进仓库、不进构建产物。<br />
        请注意：官方 Provider API <strong>没有读取用量的端点</strong>，所以这个 key
        <strong>不参与</strong>上方数字的计算 —— 数字来自
        <code>npm run sync:usage</code> 生成的本地快照。key 用于鉴权验证（TEST），
        并为将来官方开放用量接口时备用。
      </p>
    </div>

    <template #footer>
      <span>SYNCED: {{ generatedLabel }}</span>
      <span class="usage-actions">
        <button type="button" class="text-link" @click="toggleConfig">[CONFIG]</button>
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

.usage-config {
  margin-top: var(--space-3);
  padding: var(--space-3);
  background: var(--bg-sunken);
  border: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.usage-config__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-2);
}

.usage-config__masked,
.usage-config__none {
  font-family: var(--font-mono);
  font-size: 0.625rem;
}

.usage-config__masked {
  color: var(--accent-purple);
}

.usage-config__none {
  color: var(--text-faint);
}

.usage-config__reveal {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  font-size: 0.5625rem;
  color: var(--text-faint);
  cursor: pointer;
}

.usage-config__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.usage-config__actions .sharp-btn {
  flex: 1 1 5rem;
}

.usage-config__result {
  margin: 0;
  font-size: 0.625rem;
  font-family: var(--font-mono);
  line-height: 1.5;
}

.usage-config__note {
  margin: 0;
  font-size: 0.5625rem;
  color: var(--text-faint);
  line-height: 1.7;
}

.usage-config__note strong {
  color: var(--text-dim);
}

code {
  color: var(--accent-purple);
  background: var(--bg-raised);
  padding: 0 0.2rem;
}

.usage-actions {
  display: inline-flex;
  flex-wrap: wrap;
  gap: var(--space-3);
}
</style>
