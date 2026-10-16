import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { fetchUsageSnapshot, usageDataUrl, UsageDataError } from '@/services/commandCodeUsage';
import { buildUsageView } from '@/domain/usage';
import type { LoadState } from '@/types/dashboard';
import type { UsageSnapshot, UsageView } from '@/types/usage';

export const useUsageStore = defineStore('usage', () => {
  const snapshot = ref<UsageSnapshot | null>(null);
  const state = ref<LoadState>('idle');
  const error = ref<string | null>(null);
  const hint = ref<string | null>(null);

  const view = computed<UsageView | null>(() =>
    snapshot.value ? buildUsageView(snapshot.value) : null,
  );
  const isBusy = computed(() => state.value === 'loading');
  const dataUrl = computed(() => usageDataUrl());

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

  return { snapshot, state, error, hint, view, isBusy, dataUrl, load };
});
