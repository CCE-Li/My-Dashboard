<script setup lang="ts">
import { computed, ref } from 'vue';
import TileFrame from '@/components/ui/TileFrame.vue';
import { useToastStore } from '@/stores/useToastStore';
import { useUsageStore } from '@/stores/useUsageStore';
import { formatInteger, formatTokens, formatUsd } from '@/utils/format';
import type { QuotaBar } from '@/types/usage';

const store = useUsageStore();
const toast = useToastStore();

/** 只展示占比最高的若干个模型，其余合并，避免磁贴被长列表撑爆。 */
const MAX_ROWS = 5;

const visibleModels = computed(() => (store.view?.byModel ?? []).slice(0, MAX_ROWS));

const hiddenCount = computed(() =>
  Math.max(0, (store.view?.byModel ?? []).length - visibleModels.value.length),
);

const cycleLabel = computed(() => {
  const generatedAt = store.view?.generatedAt;
  if (!generatedAt) return 'CYCLE: —';
  const date = new Date(generatedAt);
  if (Number.isNaN(date.getTime())) return 'CYCLE: —';
  return `CYCLE: ${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
});

const showQuotaConfig = ref(false);
const draft = ref({ tokens5h: 0, tokens24h: 0, creditUsd: 0 });

const ROW_COLORS = ['var(--accent-purple)', 'var(--accent-cyan)', 'var(--accent)', 'var(--accent-pink)'];

function colorFor(index: number): string {
  return ROW_COLORS[index % ROW_COLORS.length] ?? 'var(--accent)';
}

/** 快用满时换色：>=80% 转黄，用满转粉。 */
function toneFor(bar: QuotaBar): string {
  if (!bar.configured) return 'var(--text-faint)';
  if (bar.percent >= 99.9) return 'var(--accent-pink)';
  if (bar.percent >= 80) return '#facc15';
  return 'var(--accent)';
}

function formatAmount(bar: QuotaBar, value: number): string {
  return bar.unit === 'usd' ? formatUsd(value) : formatTokens(value);
}

function toggleQuotaConfig(): void {
  showQuotaConfig.value = !showQuotaConfig.value;
  draft.value = { ...store.quota };
}

function saveQuota(): void {
  store.saveQuota(draft.value);
  showQuotaConfig.value = false;
  toast.push('QUOTA_SAVED: 配额已保存到本机');
}
</script>

<template>
  <TileFrame
    tile-id="models"
    title="MODEL_BREAKDOWN_MATRIX"
    edge="left"
    accent="var(--accent)"
    :meta="cycleLabel"
    site-url="https://commandcode.ai"
    site-label="Command Code 官网"
  >
    <div v-if="store.quotaBars.length > 0" class="quota">
      <div v-for="bar in store.quotaBars" :key="bar.id" class="quota__row">
        <span class="quota__label">{{ bar.label }}</span>
        <div class="pixel-bar quota__bar">
          <div
            class="pixel-bar__fill"
            :style="{ width: `${bar.percent}%`, backgroundColor: toneFor(bar) }"
          ></div>
        </div>
        <span class="quota__value">
          <template v-if="bar.configured">
            {{ formatAmount(bar, bar.used) }} / {{ formatAmount(bar, bar.quota) }}
            <em :style="{ color: toneFor(bar) }">{{ bar.percent.toFixed(0) }}%</em>
          </template>
          <template v-else>
            {{ formatAmount(bar, bar.used) }}
            <em class="quota__unset">未设配额</em>
          </template>
        </span>
      </div>
    </div>

    <div v-if="showQuotaConfig" class="quota-config">
      <p class="quota-config__note">
        配额是进度条的分母，需要你自己填：官方没有查询额度的接口，
        本地会话快照只有用量没有额度。填 0 表示不显示该条进度。
      </p>
      <label class="quota-config__field">
        <span>5H 窗口 token 配额</span>
        <input v-model.number="draft.tokens5h" type="number" min="0" class="sharp-input" />
      </label>
      <label class="quota-config__field">
        <span>24H 窗口 token 配额</span>
        <input v-model.number="draft.tokens24h" type="number" min="0" class="sharp-input" />
      </label>
      <label class="quota-config__field">
        <span>总充值额度（USD）</span>
        <input v-model.number="draft.creditUsd" type="number" min="0" step="0.01" class="sharp-input" />
      </label>
      <div class="quota-config__actions">
        <button type="button" class="sharp-btn" @click="saveQuota">APPLY_CONFIG</button>
        <button type="button" class="sharp-btn" @click="showQuotaConfig = false">CANCEL</button>
      </div>
    </div>

    <div v-if="store.view && visibleModels.length > 0" class="matrix">
      <table>
        <thead>
          <tr>
            <th>MODEL</th>
            <th>REQ</th>
            <th>TOKENS</th>
            <th class="matrix__ratio-head">RATIO</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, index) in visibleModels" :key="row.model">
            <td class="matrix__model">
              <span class="tile-dot" :style="{ backgroundColor: colorFor(index) }"></span>
              <span class="matrix__model-name" :title="row.model">{{ row.model }}</span>
            </td>
            <td class="matrix__num">{{ formatInteger(row.requests) }}</td>
            <td class="matrix__num" :style="{ color: colorFor(index) }">
              {{ formatTokens(row.totalTokens) }}
            </td>
            <td>
              <div class="matrix__ratio">
                <div class="pixel-bar matrix__bar">
                  <div
                    class="pixel-bar__fill"
                    :style="{ width: `${row.ratio}%`, backgroundColor: colorFor(index) }"
                  ></div>
                </div>
                <span class="matrix__percent">{{ row.ratio.toFixed(0) }}%</span>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <p class="matrix__note">
        合计 {{ formatTokens(store.view.totalTokens) }} tokens ·
        {{ formatUsd(store.view.costUsd) }}
        <span v-if="hiddenCount > 0">· 另有 {{ hiddenCount }} 个模型未展示</span>
      </p>
    </div>

    <p v-else-if="store.state === 'loading'" class="matrix__empty">正在读取用量快照…</p>

    <p v-else class="matrix__empty">
      还没有模型用量数据。<br />
      <span class="matrix__empty-hint">
        在本仓库运行 <code>npm run sync:usage</code> 扫描 ~/.commandcode 会话文件生成快照。
      </span>
    </p>

    <template #footer>
      <span>配额需自行配置 · 官方无额度接口</span>
      <button type="button" class="text-link" @click="toggleQuotaConfig">[CONFIG]</button>
    </template>
  </TileFrame>
</template>

<style scoped>
.quota {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  margin-bottom: var(--space-3);
  padding-bottom: var(--space-3);
  border-bottom: 1px solid var(--border-subtle);
}

.quota__row {
  display: grid;
  grid-template-columns: 3.25rem minmax(4rem, 1fr) auto;
  align-items: center;
  gap: var(--space-2);
  font-size: 0.625rem;
  font-family: var(--font-mono);
}

.quota__label {
  color: var(--text-dim);
}

.quota__bar {
  height: 8px;
}

.quota__value {
  color: var(--text-faint);
  white-space: nowrap;
}

.quota__value em {
  font-style: normal;
  font-weight: 700;
  margin-left: var(--space-1);
}

.quota__unset {
  color: var(--text-faint) !important;
  font-weight: 400 !important;
}

.quota-config {
  margin-bottom: var(--space-3);
  padding: var(--space-3);
  background: var(--bg-sunken);
  border: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.quota-config__note {
  margin: 0;
  font-size: 0.5625rem;
  color: var(--text-faint);
  line-height: 1.6;
}

.quota-config__field {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  font-size: 0.5625rem;
  color: var(--text-dim);
}

.quota-config__actions {
  display: flex;
  gap: var(--space-2);
}

.quota-config__actions .sharp-btn {
  flex: 1;
}

.matrix {
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
  font-family: var(--font-mono);
  font-size: 0.75rem;
}

th {
  font-size: 0.625rem;
  color: var(--text-faint);
  font-weight: 400;
  padding-bottom: var(--space-2);
  border-bottom: 1px solid var(--border);
}

.matrix__ratio-head {
  width: 33%;
}

td {
  padding: var(--space-2) 0;
  color: var(--text-body);
  vertical-align: middle;
}

tbody tr + tr td {
  border-top: 1px solid var(--border-fill);
}

.matrix__model {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  max-width: 14rem;
}

.matrix__model-name {
  color: var(--text-primary);
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.matrix__num {
  color: var(--text-dim);
  white-space: nowrap;
}

.matrix__ratio {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.matrix__bar {
  height: 8px;
}

.matrix__percent {
  font-size: 0.625rem;
  color: var(--text-faint);
  width: 2.25rem;
  text-align: right;
}

.matrix__note {
  margin: var(--space-3) 0 0;
  font-size: 0.625rem;
  color: var(--text-faint);
}

.matrix__empty {
  margin: 0;
  font-size: 0.6875rem;
  color: var(--text-dim);
  line-height: 1.6;
}

.matrix__empty-hint {
  color: var(--text-faint);
  font-size: 0.625rem;
}

code {
  color: var(--accent);
  background: var(--bg-sunken);
  padding: 0 0.25rem;
}
</style>
