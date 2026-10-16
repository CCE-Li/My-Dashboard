<script setup lang="ts">
import { computed } from 'vue';
import TileFrame from '@/components/ui/TileFrame.vue';
import { useUsageStore } from '@/stores/useUsageStore';
import { formatInteger, formatTokens, formatUsd } from '@/utils/format';

const store = useUsageStore();

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

const ROW_COLORS = ['var(--accent-purple)', 'var(--accent-cyan)', 'var(--accent)', 'var(--accent-pink)'];

function colorFor(index: number): string {
  return ROW_COLORS[index % ROW_COLORS.length] ?? 'var(--accent)';
}
</script>

<template>
  <TileFrame
    tile-id="models"
    title="MODEL_BREAKDOWN_MATRIX"
    edge="left"
    accent="var(--accent)"
    :meta="cycleLabel"
  >
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
  </TileFrame>
</template>

<style scoped>
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
