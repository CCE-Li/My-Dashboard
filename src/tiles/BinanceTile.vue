<script setup lang="ts">
import { computed, onMounted } from 'vue';
import DataSourceBadge from '@/components/ui/DataSourceBadge.vue';
import StatBlock from '@/components/ui/StatBlock.vue';
import TileFrame from '@/components/ui/TileFrame.vue';
import { buildSparklinePath, changePercent } from '@/domain/binance';
import { useBinanceStore } from '@/stores/useBinanceStore';
import { useToastStore } from '@/stores/useToastStore';
import { useUiStore } from '@/stores/useUiStore';
import { formatRelativeFromSeconds } from '@/utils/time';

const store = useBinanceStore();
const toast = useToastStore();
const ui = useUiStore();

const SPARK_WIDTH = 88;
const SPARK_HEIGHT = 22;

const positions = computed(() => store.sortedPositions);
const summary = computed(() => store.summary);

const origin = computed(() => {
  if (store.state === 'ready') return 'live';
  if (store.state === 'error') return 'empty';
  return store.hasCredentials ? 'cached' : 'empty';
});

const syncedLabel = computed(() => {
  if (!store.fetchedAt) return 'NOT_SYNCED';
  return formatRelativeFromSeconds(Math.floor(store.fetchedAt / 1000));
});

const pnlTone = computed(() => (summary.value.totalPnl >= 0 ? 'var(--accent)' : 'var(--accent-pink)'));

/** 价格量级差异很大（BTC 8 万 / 小币 0.0001），按大小决定小数位 */
function formatPrice(value: number): string {
  if (!Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  const digits = abs >= 1000 ? 2 : abs >= 1 ? 3 : abs >= 0.01 ? 5 : 8;
  return new Intl.NumberFormat('zh-CN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

function formatSigned(value: number, digits = 2): string {
  const sign = value > 0 ? '+' : value < 0 ? '-' : '';
  return `${sign}$${Math.abs(value).toLocaleString('zh-CN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
}

function formatPercent(value: number): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

function toneOf(value: number): string {
  if (value > 0) return 'var(--accent)';
  if (value < 0) return 'var(--accent-pink)';
  return 'var(--text-dim)';
}

function sparkPath(closes: readonly number[]): string {
  return buildSparklinePath(closes, SPARK_WIDTH, SPARK_HEIGHT);
}

function quoteChange(closes: readonly number[]): number {
  if (closes.length < 2) return 0;
  return changePercent(closes[0] as number, closes[closes.length - 1] as number);
}

async function sync(): Promise<void> {
  await store.sync();
  if (store.state === 'ready') {
    toast.push('BINANCE_SYNCED: 持仓与行情已刷新');
  } else {
    toast.push(`BINANCE_SYNC_FAILED: ${store.error ?? '未知错误'}`);
  }
}

onMounted(() => {
  void store.sync();
});
</script>

<template>
  <TileFrame
    tile-id="binance"
    title="BINANCE_FUTURES"
    accent="#f0b90b"
    edge="top"
    site-url="https://www.binance.com/zh-CN/futures/USDT/BTCUSDT"
    site-label="币安 U 本位合约"
  >
    <template #meta>
      <span class="bn-meta">
        <DataSourceBadge :origin="origin" :label="origin === 'live' ? 'LIVE' : 'NO_KEY'" />
        <span>{{ positions.length }} POS</span>
      </span>
    </template>

    <!-- 持仓汇总 -->
    <div class="bn-summary">
      <StatBlock
        label="未实现盈亏"
        :value="formatSigned(summary.totalPnl)"
        :tone="pnlTone"
        :note="`多 ${summary.longCount} · 空 ${summary.shortCount}`"
      />
      <StatBlock
        label="盈亏分布"
        :value="`${summary.winnerCount} / ${summary.loserCount}`"
        tone="var(--accent-cyan)"
        note="盈利 / 亏损 仓位数"
      />
    </div>

    <!-- 持仓明细 -->
    <div v-if="positions.length > 0" class="bn-positions">
      <table>
        <thead>
          <tr>
            <th>SYMBOL</th>
            <th>SIDE</th>
            <th>SIZE</th>
            <th>ENTRY</th>
            <th>MARK</th>
            <th class="bn-right">PNL</th>
            <th class="bn-right">ROE</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="position in positions" :key="`${position.symbol}-${position.side}`">
            <td class="bn-symbol">{{ position.symbol }}</td>
            <td>
              <span class="bn-side" :class="position.side === 'LONG' ? 'bn-side--long' : 'bn-side--short'">
                {{ position.side }}
              </span>
              <span class="bn-lev">{{ position.leverage }}x</span>
            </td>
            <td class="bn-num">{{ formatPrice(position.amount) }}</td>
            <td class="bn-num">{{ formatPrice(position.entryPrice) }}</td>
            <td class="bn-num">{{ formatPrice(position.markPrice) }}</td>
            <td class="bn-num bn-right" :style="{ color: toneOf(position.unrealizedPnl) }">
              {{ formatSigned(position.unrealizedPnl) }}
            </td>
            <td class="bn-num bn-right" :style="{ color: toneOf(position.unrealizedPnl) }">
              {{ formatPercent(position.roePercent) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <p v-else-if="store.positionsError" class="bn-hint bn-hint--warn">
      {{ store.positionsError }}
      <button type="button" class="text-link" @click="ui.openSettings()">[去设置]</button>
    </p>

    <p v-else-if="store.state === 'ready'" class="bn-hint">当前没有持仓。</p>

    <!-- 观察列表 -->
    <div v-if="store.quotes.length > 0" class="bn-watch">
      <div class="bn-watch__head">
        <span class="metric-label">WATCHLIST ({{ store.quotes.length }}):</span>
        <span class="bn-watch__hint">1H × 24 走势</span>
      </div>
      <div
        v-for="quote in store.quotes"
        :key="quote.symbol"
        class="bn-watch__row"
        :title="`${quote.symbol} 24h 成交额 ${Math.round(quote.quoteVolume).toLocaleString('zh-CN')} USDT`"
      >
        <span class="bn-watch__symbol">{{ quote.symbol }}</span>
        <span class="bn-watch__price">{{ formatPrice(quote.lastPrice) }}</span>
        <span class="bn-watch__change" :style="{ color: toneOf(quoteChange(quote.closes)) }">
          {{ formatPercent(quoteChange(quote.closes)) }}
        </span>
        <svg
          class="bn-watch__spark"
          :width="SPARK_WIDTH"
          :height="SPARK_HEIGHT"
          :viewBox="`0 0 ${SPARK_WIDTH} ${SPARK_HEIGHT}`"
          preserveAspectRatio="none"
          role="img"
          :aria-label="`${quote.symbol} 近 24 小时走势`"
        >
          <path
            :d="sparkPath(quote.closes)"
            fill="none"
            :stroke="toneOf(quoteChange(quote.closes))"
            stroke-width="1.2"
            stroke-linejoin="round"
          />
        </svg>
      </div>
    </div>

    <p v-if="store.error" class="bn-hint bn-hint--warn">{{ store.error }}</p>

    <template #footer>
      <span>SYNCED: {{ syncedLabel }}</span>
      <span class="bn-actions">
        <button type="button" class="text-link" @click="ui.openSettings()">[CONFIG]</button>
        <button type="button" class="text-link" :disabled="store.isBusy" @click="sync">
          {{ store.isBusy ? '[SYNCING...]' : '[SYNC]' }}
        </button>
      </span>
    </template>
  </TileFrame>
</template>

<style scoped>
.bn-meta {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
}

.bn-summary {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-2);
  margin-bottom: var(--space-3);
}

.bn-positions {
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
  font-family: var(--font-mono);
  font-size: 0.6875rem;
  text-align: left;
}

th {
  font-size: 0.5625rem;
  font-weight: 400;
  color: var(--text-faint);
  padding-bottom: var(--space-2);
  border-bottom: 1px solid var(--border);
}

td {
  padding: 0.375rem 0;
  color: var(--text-body);
  white-space: nowrap;
}

tbody tr + tr td {
  border-top: 1px solid var(--border-fill);
}

.bn-right {
  text-align: right;
}

.bn-symbol {
  color: var(--text-primary);
  font-weight: 700;
}

.bn-num {
  color: var(--text-dim);
}

.bn-side {
  font-weight: 700;
  font-size: 0.5625rem;
  padding: 0 0.1875rem;
  border: 1px solid currentColor;
}

.bn-side--long {
  color: var(--accent);
}

.bn-side--short {
  color: var(--accent-pink);
}

.bn-lev {
  margin-left: var(--space-1);
  font-size: 0.5625rem;
  color: var(--text-faint);
}

.bn-watch {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  margin-top: var(--space-3);
  padding-top: var(--space-3);
  border-top: 1px solid var(--border-subtle);
}

.bn-watch__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}

.bn-watch__hint {
  font-size: 0.5625rem;
  color: var(--text-faint);
}

.bn-watch__row {
  display: grid;
  grid-template-columns: 5.5rem minmax(4rem, 1fr) 4.5rem auto;
  align-items: center;
  gap: var(--space-2);
  font-family: var(--font-mono);
  font-size: 0.6875rem;
}

.bn-watch__symbol {
  color: var(--text-primary);
  font-weight: 700;
}

.bn-watch__price {
  color: var(--text-body);
}

.bn-watch__change {
  text-align: right;
}

.bn-watch__spark {
  display: block;
  overflow: visible;
}

.bn-hint {
  margin: var(--space-3) 0 0;
  font-size: 0.625rem;
  color: var(--text-dim);
  line-height: 1.6;
}

.bn-hint--warn {
  color: var(--accent-pink);
  border-left: 2px solid var(--accent-pink);
  padding-left: var(--space-2);
}

.bn-actions {
  display: inline-flex;
  gap: var(--space-3);
}
</style>
