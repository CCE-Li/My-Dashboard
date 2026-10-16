import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { APP_CONFIG } from '@/config/app.config';
import { CodeforcesApiError, normalizeHandle, syncCodeforces } from '@/services/codeforcesApi';
import { readJson, readText, STORAGE_KEYS, writeJson, writeText } from '@/services/storage';
import type { CodeforcesStats } from '@/types/codeforces';
import type { LoadState } from '@/types/dashboard';

interface CachedStats {
  stats: CodeforcesStats;
  cachedAt: number;
  ok: boolean;
}

export const useCodeforcesStore = defineStore('codeforces', () => {
  const handle = ref(
    readText(STORAGE_KEYS.codeforcesHandle, APP_CONFIG.codeforces.defaultHandle),
  );
  const stats = ref<CodeforcesStats | null>(null);
  const state = ref<LoadState>('idle');
  const error = ref<string | null>(null);

  const isConfigured = computed(() => normalizeHandle(handle.value).length > 0);
  const isBusy = computed(() => state.value === 'loading');

  function setHandle(next: string): void {
    handle.value = next;
    writeText(STORAGE_KEYS.codeforcesHandle, next);
    writeJson(STORAGE_KEYS.codeforcesCache, null);
  }

  function readCache(): CachedStats | null {
    const cached = readJson<CachedStats | null>(STORAGE_KEYS.codeforcesCache, null);
    if (!cached || !cached.stats) return null;
    if (cached.stats.handle.toLowerCase() !== normalizeHandle(handle.value).toLowerCase()) {
      return null;
    }
    const ttl = cached.ok
      ? APP_CONFIG.codeforces.cacheTtlMs
      : APP_CONFIG.codeforces.errorCacheTtlMs;
    return Date.now() - cached.cachedAt < ttl ? cached : null;
  }

  /** 先用缓存渲染，再视情况真的打接口。 */
  async function sync(force = false): Promise<void> {
    if (!isConfigured.value) {
      state.value = 'idle';
      error.value = null;
      return;
    }

    if (!force) {
      const cached = readCache();
      if (cached) {
        stats.value = cached.stats;
        state.value = 'ready';
        error.value = null;
        return;
      }
    }

    state.value = 'loading';
    error.value = null;

    try {
      const next = await syncCodeforces(handle.value);
      stats.value = next;
      writeJson(STORAGE_KEYS.codeforcesCache, {
        stats: next,
        cachedAt: Date.now(),
        ok: true,
      } satisfies CachedStats);
      state.value = 'ready';
    } catch (caught) {
      error.value =
        caught instanceof CodeforcesApiError
          ? caught.message
          : `同步失败：${caught instanceof Error ? caught.message : String(caught)}`;
      state.value = 'error';
      writeJson(STORAGE_KEYS.codeforcesCache, null);
    }
  }

  return {
    handle,
    stats,
    state,
    error,
    isConfigured,
    isBusy,
    setHandle,
    sync,
  };
});
