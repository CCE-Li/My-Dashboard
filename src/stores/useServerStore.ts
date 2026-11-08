import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { normalizeServerMetrics } from '@/domain/server';
import {
  fetchServerMetrics,
  normalizeEndpoint,
  ServerMetricsError,
} from '@/services/serverMetrics';
import { readText, STORAGE_KEYS, writeText } from '@/services/storage';
import type { LoadState } from '@/types/dashboard';
import type { ServerView } from '@/types/server';

/** 服务器信息磁贴的状态。端点地址存本机，磁贴只读不写。 */
export const useServerStore = defineStore('server', () => {
  const endpoint = ref(readText(STORAGE_KEYS.serverMetricsEndpoint, ''));
  const view = ref<ServerView | null>(null);
  const state = ref<LoadState>('idle');
  const error = ref<string | null>(null);
  const fetchedAt = ref<number | null>(null);

  const isConfigured = computed(() => endpoint.value.trim().length > 0);
  const isBusy = computed(() => state.value === 'loading');

  function saveEndpoint(input: string): void {
    endpoint.value = normalizeEndpoint(input);
    writeText(STORAGE_KEYS.serverMetricsEndpoint, endpoint.value);
  }

  function describeFailure(caught: unknown): string {
    return caught instanceof ServerMetricsError
      ? caught.message
      : `请求失败：${caught instanceof Error ? caught.message : String(caught)}`;
  }

  async function sync(): Promise<void> {
    if (!isConfigured.value) {
      state.value = 'idle';
      error.value = null;
      view.value = null;
      return;
    }

    state.value = 'loading';
    error.value = null;
    try {
      const raw = await fetchServerMetrics(endpoint.value);
      view.value = normalizeServerMetrics(raw);
      fetchedAt.value = Date.now();
      state.value = 'ready';
    } catch (caught) {
      view.value = null;
      error.value = describeFailure(caught);
      state.value = 'error';
    }
  }

  return {
    endpoint,
    view,
    state,
    error,
    fetchedAt,
    isConfigured,
    isBusy,
    saveEndpoint,
    sync,
  };
});
