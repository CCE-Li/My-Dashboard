import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import {
  extractCloses,
  normalizePosition,
  sortByPnlMagnitude,
  summarizePositions,
} from '@/domain/binance';
import {
  BinanceApiError,
  DEFAULT_BINANCE_BASE_URL,
  fetchKlines,
  fetchPositionRisk,
  fetchServerTimeOffset,
  fetchTicker24h,
  fetchEgressIp,
  normalizeBaseUrl,
  selfCheck,
  type BinancePingStep,
} from '@/services/binanceApi';
import { readJson, readText, STORAGE_KEYS, writeJson, writeText } from '@/services/storage';
import type { NormalizedPosition, PositionSummary, WatchQuote } from '@/types/binance';
import type { LoadState } from '@/types/dashboard';

/** 默认观察列表：留空也可以，但有个起点更容易看出效果。 */
const DEFAULT_WATCHLIST = ['BTCUSDT', 'ETHUSDT'];

function normalizeSymbols(input: readonly string[]): string[] {
  const seen = new Set<string>();
  const symbols: string[] = [];
  for (const item of input) {
    const symbol = item.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!symbol || seen.has(symbol)) continue;
    seen.add(symbol);
    symbols.push(symbol);
  }
  return symbols.slice(0, 8);
}

export const useBinanceStore = defineStore('binance', () => {
  const apiKey = ref(readText(STORAGE_KEYS.binanceApiKey, ''));
  const apiSecret = ref(readText(STORAGE_KEYS.binanceApiSecret, ''));
  const watchlist = ref<string[]>(
    normalizeSymbols(readJson<string[]>(STORAGE_KEYS.binanceWatchlist, DEFAULT_WATCHLIST)),
  );
  /** API 根地址：币安在部分地区不可达时需要换成自建反代 */
  const apiBase = ref(
    normalizeBaseUrl(readText(STORAGE_KEYS.binanceApiBase, DEFAULT_BINANCE_BASE_URL)),
  );

  const positions = ref<NormalizedPosition[]>([]);
  const quotes = ref<WatchQuote[]>([]);
  const state = ref<LoadState>('idle');
  const error = ref<string | null>(null);
  const positionsError = ref<string | null>(null);
  const fetchedAt = ref<number | null>(null);
  /** 本机出口 IP 的参考值（用于对照币安 IP 白名单） */
  const egressIp = ref<string | null>(null);

  const hasCredentials = computed(
    () => apiKey.value.trim().length > 0 && apiSecret.value.trim().length > 0,
  );
  const isBusy = computed(() => state.value === 'loading');

  const summary = computed<PositionSummary>(() => summarizePositions(positions.value));
  const sortedPositions = computed(() => sortByPnlMagnitude(positions.value));

  const maskedKey = computed(() => {
    const key = apiKey.value.trim();
    if (!key) return '';
    return key.length <= 8 ? `${key.slice(0, 3)}…` : `${key.slice(0, 6)}…${key.slice(-4)}`;
  });

  function saveCredentials(nextKey: string, nextSecret: string): void {
    apiKey.value = nextKey.trim();
    apiSecret.value = nextSecret.trim();
    writeText(STORAGE_KEYS.binanceApiKey, apiKey.value);
    writeText(STORAGE_KEYS.binanceApiSecret, apiSecret.value);
  }

  function saveWatchlist(input: string): void {
    watchlist.value = normalizeSymbols(input.split(/[\s,]+/));
    writeJson(STORAGE_KEYS.binanceWatchlist, watchlist.value);
  }

  function saveApiBase(input: string): void {
    apiBase.value = normalizeBaseUrl(input);
    writeText(STORAGE_KEYS.binanceApiBase, apiBase.value);
  }

  function clearCredentials(): void {
    apiKey.value = '';
    apiSecret.value = '';
    writeText(STORAGE_KEYS.binanceApiKey, '');
    writeText(STORAGE_KEYS.binanceApiSecret, '');
    positions.value = [];
    positionsError.value = null;
  }

  function describeFailure(caught: unknown): string {
    return caught instanceof BinanceApiError
      ? caught.message
      : `请求失败：${caught instanceof Error ? caught.message : String(caught)}`;
  }

  /**
   * 拉取一次快照。
   * 行情与持仓是两条独立链路：持仓失败（未配置/权限不足）不应连累行情展示。
   */
  async function sync(): Promise<void> {
    state.value = 'loading';
    error.value = null;
    positionsError.value = null;

    let timeOffsetMs = 0;
    try {
      timeOffsetMs = await fetchServerTimeOffset(apiBase.value);
    } catch (caught) {
      error.value = describeFailure(caught);
      state.value = 'error';
      return;
    }

    if (hasCredentials.value) {
      try {
        const raw = await fetchPositionRisk(
          apiKey.value,
          apiSecret.value,
          timeOffsetMs,
          apiBase.value,
        );
        positions.value = raw
          .map((item) => normalizePosition(item))
          .filter((item): item is NormalizedPosition => item !== null);
      } catch (caught) {
        positions.value = [];
        positionsError.value = describeFailure(caught);
      }
    } else {
      positions.value = [];
      positionsError.value = '未配置 API key / secret，无法读取持仓';
    }

    try {
      const collected: WatchQuote[] = [];
      for (const symbol of watchlist.value) {
        const [ticker, klines] = await Promise.all([
          fetchTicker24h(symbol, apiBase.value),
          fetchKlines(symbol, '1h', 24, apiBase.value),
        ]);
        const closes = extractCloses(klines as unknown as unknown[][]);
        collected.push({
          symbol,
          lastPrice: Number(ticker.lastPrice),
          changePercent: Number(ticker.priceChangePercent),
          quoteVolume: Number(ticker.quoteVolume),
          closes,
        });
      }
      quotes.value = collected;
      fetchedAt.value = Date.now();
      state.value = 'ready';
    } catch (caught) {
      error.value = describeFailure(caught);
      state.value = 'error';
    }
  }

  /** 设置面板里的「测试」：验证 key/secret 能否读到持仓。 */
  async function testCredentials(): Promise<{ ok: boolean; detail: string }> {
    if (!hasCredentials.value) {
      return { ok: false, detail: '还没有填写 API key 与 secret' };
    }
    try {
      const offset = await fetchServerTimeOffset(apiBase.value);
      const raw = await fetchPositionRisk(
        apiKey.value,
        apiSecret.value,
        offset,
        apiBase.value,
      );
      const open = raw.filter((item) => Number(item.positionAmt) !== 0).length;
      return { ok: true, detail: `鉴权通过，当前 ${open} 个持仓` };
    } catch (caught) {
      return { ok: false, detail: describeFailure(caught) };
    }
  }

  /** 三步自检：可达性 → 公开读 → 鉴权。用来定位「连不上」卡在哪。 */
  async function runSelfCheck(): Promise<BinancePingStep[]> {
    // 白名单排错需要知道"币安看到的是哪个 IP"，顺手一起取
    egressIp.value = await fetchEgressIp();
    return selfCheck(apiKey.value, apiSecret.value, apiBase.value);
  }

  /** 供设置面板校验观察列表里的交易对是否可用（用公开接口探测）。 */
  async function validateSymbols(input: string): Promise<string> {
    const symbols = normalizeSymbols(input.split(/[\s,]+/));
    if (symbols.length === 0) return '至少填一个交易对，如 BTCUSDT';
    const invalid: string[] = [];
    for (const symbol of symbols) {
      try {
        await fetchTicker24h(symbol, apiBase.value);
      } catch {
        invalid.push(symbol);
      }
    }
    return invalid.length > 0 ? `这些交易对查不到行情：${invalid.join('、')}` : '';
  }

  return {
    apiKey,
    apiSecret,
    apiBase,
    watchlist,
    positions,
    sortedPositions,
    quotes,
    state,
    error,
    positionsError,
    fetchedAt,
    egressIp,
    hasCredentials,
    isBusy,
    summary,
    maskedKey,
    saveCredentials,
    saveWatchlist,
    saveApiBase,
    clearCredentials,
    sync,
    testCredentials,
    runSelfCheck,
    validateSymbols,
  };
});
