import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import {
  clearCachedBackup,
  loadCachedBackup,
  parseBrzBackup,
  readFromIndexedDb,
  saveCachedBackup,
  type BrzImportMeta,
  type BrzUnavailableReason,
} from '@/services/brzFundSource';
import type { BrzFundSnapshot } from '@/types/brzFund';
import type { DataOrigin, LoadState } from '@/types/dashboard';

/**
 * BRZ 磁贴的数据编排：先试同源直读，拿不到就退回导入的备份快照。
 * 只读，绝不回写 brz-fund 数据库。
 */
export const useBrzStore = defineStore('brz', () => {
  const snapshot = ref<BrzFundSnapshot | null>(null);
  const state = ref<LoadState>('idle');
  const unavailable = ref<string | null>(null);
  const unavailableReason = ref<BrzUnavailableReason | null>(null);
  const importMeta = ref<BrzImportMeta | null>(null);

  const origin = computed<DataOrigin>(() => {
    if (!snapshot.value) return 'empty';
    return snapshot.value.origin === 'indexeddb' ? 'live' : 'imported';
  });
  const isBusy = computed(() => state.value === 'loading');

  function applyBackupCache(): boolean {
    const cached = loadCachedBackup();
    if (!cached.snapshot) return false;
    snapshot.value = cached.snapshot;
    importMeta.value = cached.meta;
    return true;
  }

  /** 拉取最新数据：同源直读优先，失败时保留已导入的快照。 */
  async function load(now: Date = new Date()): Promise<void> {
    state.value = 'loading';

    const outcome = await readFromIndexedDb(now);

    if (outcome.status === 'ok') {
      snapshot.value = outcome.snapshot;
      unavailable.value = null;
      unavailableReason.value = null;
      state.value = 'ready';
      return;
    }

    unavailable.value = outcome.detail;
    unavailableReason.value = outcome.reason;

    if (!applyBackupCache()) {
      snapshot.value = null;
      importMeta.value = null;
    }
    state.value = snapshot.value ? 'ready' : 'idle';
  }

  /**
   * 导入 BRZ-Fund 导出的 JSON 备份。返回 null 表示成功，否则返回错误原因。
   */
  async function importBackup(file: File, now: Date = new Date()): Promise<string | null> {
    let text: string;
    try {
      text = await file.text();
    } catch {
      return '读取文件失败';
    }

    const result = parseBrzBackup(text, now);
    if (result.status === 'error') return result.detail;

    snapshot.value = result.snapshot;
    importMeta.value = { fileName: file.name, importedAt: result.snapshot.capturedAt };
    saveCachedBackup(result.snapshot, importMeta.value);
    unavailable.value = null;
    state.value = 'ready';
    return null;
  }

  function removeImportedBackup(): void {
    clearCachedBackup();
    snapshot.value = null;
    importMeta.value = null;
    if (unavailable.value) state.value = 'idle';
  }

  return {
    snapshot,
    state,
    unavailable,
    unavailableReason,
    importMeta,
    origin,
    isBusy,
    load,
    importBackup,
    removeImportedBackup,
  };
});
