import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { buildNapcatView, healthOf } from '@/domain/napcat';
import {
  DEFAULT_NAPCAT_BASE_URL,
  fetchNapcatSnapshot,
  NapcatApiError,
  normalizeNapcatBaseUrl,
  pingNapcat,
} from '@/services/napcatApi';
import { readText, STORAGE_KEYS, writeText } from '@/services/storage';
import type { LoadState } from '@/types/dashboard';
import type { NapcatView } from '@/types/napcat';

/** NapCat / bot 磁贴的状态。地址与 token 只存本机 localStorage。 */
export const useNapcatStore = defineStore('napcat', () => {
  const baseUrl = ref(
    normalizeNapcatBaseUrl(readText(STORAGE_KEYS.napcatBaseUrl, DEFAULT_NAPCAT_BASE_URL)),
  );
  const token = ref(readText(STORAGE_KEYS.napcatToken, ''));

  const view = ref<NapcatView | null>(null);
  const state = ref<LoadState>('idle');
  const error = ref<string | null>(null);
  const fetchedAt = ref<number | null>(null);

  const hasToken = computed(() => token.value.trim().length > 0);
  const isBusy = computed(() => state.value === 'loading');
  const health = computed(() => (view.value ? healthOf(view.value) : 'offline'));

  const maskedToken = computed(() => {
    const value = token.value.trim();
    if (!value) return '';
    return value.length <= 8 ? '••••' : `${value.slice(0, 4)}…${value.slice(-2)}`;
  });

  function saveConfig(nextBaseUrl: string, nextToken: string): void {
    baseUrl.value = normalizeNapcatBaseUrl(nextBaseUrl);
    token.value = nextToken.trim();
    writeText(STORAGE_KEYS.napcatBaseUrl, baseUrl.value);
    writeText(STORAGE_KEYS.napcatToken, token.value);
  }

  function clearToken(): void {
    token.value = '';
    writeText(STORAGE_KEYS.napcatToken, '');
  }

  function describeFailure(caught: unknown): string {
    return caught instanceof NapcatApiError
      ? caught.message
      : `请求失败：${caught instanceof Error ? caught.message : String(caught)}`;
  }

  async function sync(): Promise<void> {
    state.value = 'loading';
    error.value = null;
    try {
      const snapshot = await fetchNapcatSnapshot(baseUrl.value, token.value);
      view.value = buildNapcatView(
        snapshot.status,
        snapshot.version,
        snapshot.login,
        snapshot.friendCount,
        snapshot.groupCount,
      );
      fetchedAt.value = Date.now();
      state.value = 'ready';
    } catch (caught) {
      view.value = null;
      error.value = describeFailure(caught);
      state.value = 'error';
    }
  }

  /** 设置面板里的「测试」：get_version_info + get_status 能通即成功。 */
  async function testConnection(): Promise<{ ok: boolean; detail: string }> {
    try {
      const result = await pingNapcat(baseUrl.value, token.value);
      return {
        ok: true,
        detail: `连接成功：${result.appVersion}，当前${result.online ? '在线' : '离线'}`,
      };
    } catch (caught) {
      return { ok: false, detail: describeFailure(caught) };
    }
  }

  return {
    baseUrl,
    token,
    view,
    state,
    error,
    fetchedAt,
    hasToken,
    isBusy,
    health,
    maskedToken,
    saveConfig,
    clearToken,
    sync,
    testConnection,
  };
});
