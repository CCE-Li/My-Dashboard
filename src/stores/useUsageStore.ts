import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import {
  DEFAULT_USAGE_SPAN,
  getUsageSpan,
  isUsageSpanId,
  stepUsageSpan,
  type UsageSpanId,
} from '@/config/usageSpans';
import { buildQuotaBars, buildUsageView, normalizeQuotaConfig } from '@/domain/usage';
import { verifyApiKey, type ApiKeyCheckResult } from '@/services/commandCodeApi';
import { fetchUsageSnapshot, usageDataUrl, UsageDataError } from '@/services/commandCodeUsage';
import { readJson, readText, removeKey, STORAGE_KEYS, writeJson, writeText } from '@/services/storage';
import type { LoadState } from '@/types/dashboard';
import type { QuotaBar, QuotaConfig, UsageSnapshot, UsageView } from '@/types/usage';

export const useUsageStore = defineStore('usage', () => {
  const snapshot = ref<UsageSnapshot | null>(null);
  const state = ref<LoadState>('idle');
  const error = ref<string | null>(null);
  const hint = ref<string | null>(null);

  /** API key 只存本机 localStorage，绝不进仓库、不进构建产物。 */
  const apiKey = ref(readText(STORAGE_KEYS.commandCodeApiKey, ''));
  const keyCheck = ref<ApiKeyCheckResult | null>(null);
  const checkingKey = ref(false);

  /** 条形图的时间跨度档位（滚轮调节） */
  const storedSpan = readText(STORAGE_KEYS.usageSpan, DEFAULT_USAGE_SPAN);
  const spanId = ref<UsageSpanId>(isUsageSpanId(storedSpan) ? storedSpan : DEFAULT_USAGE_SPAN);
  const span = computed(() => getUsageSpan(spanId.value));

  const view = computed<UsageView | null>(() =>
    snapshot.value ? buildUsageView(snapshot.value, span.value) : null,
  );
  const isBusy = computed(() => state.value === 'loading');
  const dataUrl = computed(() => usageDataUrl());
  const hasApiKey = computed(() => apiKey.value.trim().length > 0);

  /** 配额（进度条分母）。官方没有额度查询接口，只能由用户自己填。 */
  const quota = ref<QuotaConfig>(normalizeQuotaConfig(readJson(STORAGE_KEYS.quotaConfig, null)));
  const quotaBars = computed<QuotaBar[]>(() =>
    snapshot.value ? buildQuotaBars(snapshot.value, quota.value) : [],
  );
  const hasQuota = computed(() => quota.value.tokens5h > 0 || quota.value.tokens24h > 0 || quota.value.creditUsd > 0);

  /** 界面上只展示打码后的 key，永远不回显完整值。 */
  const maskedApiKey = computed(() => {
    const key = apiKey.value.trim();
    if (!key) return '';
    if (key.length <= 12) return `${key.slice(0, 3)}…`;
    return `${key.slice(0, 8)}…${key.slice(-4)}`;
  });

  async function load(): Promise<void> {
    state.value = 'loading';
    error.value = null;
    hint.value = null;
    try {
      snapshot.value = await fetchUsageSnapshot();
      state.value = 'ready';
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === 'AbortError') return;
      error.value = caught instanceof Error ? caught.message : String(caught);
      hint.value = caught instanceof UsageDataError ? caught.hint : null;
      state.value = 'error';
    }
  }

  function saveApiKey(value: string): void {
    apiKey.value = value.trim();
    writeText(STORAGE_KEYS.commandCodeApiKey, apiKey.value);
    keyCheck.value = null;
  }

  function clearApiKey(): void {
    apiKey.value = '';
    removeKey(STORAGE_KEYS.commandCodeApiKey);
    keyCheck.value = null;
  }

  async function checkApiKey(): Promise<void> {
    checkingKey.value = true;
    try {
      keyCheck.value = await verifyApiKey(apiKey.value);
    } finally {
      checkingKey.value = false;
    }
  }

  /** 切换条形图跨度：direction = -1 看得更细，1 看得更远。 */
  function stepSpan(direction: 1 | -1): void {
    spanId.value = stepUsageSpan(spanId.value, direction);
    writeText(STORAGE_KEYS.usageSpan, spanId.value);
  }

  function saveQuota(next: QuotaConfig): void {
    const normalized = normalizeQuotaConfig(next);
    quota.value = normalized;
    writeJson(STORAGE_KEYS.quotaConfig, normalized);
  }

  return {
    snapshot,
    state,
    error,
    hint,
    view,
    isBusy,
    dataUrl,
    apiKey,
    keyCheck,
    checkingKey,
    hasApiKey,
    maskedApiKey,
    spanId,
    span,
    quota,
    quotaBars,
    hasQuota,
    load,
    saveApiKey,
    clearApiKey,
    checkApiKey,
    stepSpan,
    saveQuota,
  };
});
