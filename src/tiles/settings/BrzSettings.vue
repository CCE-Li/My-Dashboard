<script setup lang="ts">
import { computed, ref } from 'vue';
import { useBrzStore } from '@/stores/useBrzStore';
import { useToastStore } from '@/stores/useToastStore';
import { formatIsoLocal } from '@/utils/time';

const brz = useBrzStore();
const toast = useToastStore();

const importing = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);

const brzSourceLabel = computed(() => {
  if (brz.snapshot?.origin === 'indexeddb') return '同源直读 brz-fund';
  if (brz.snapshot?.origin === 'backup') return '导入的 JSON 快照';
  return '未接入';
});

function pickBackup(): void {
  fileInput.value?.click();
}

async function onFileChange(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;

  importing.value = true;
  const failure = await brz.importBackup(file);
  importing.value = false;

  toast.push(failure ? `BRZ_IMPORT_FAILED: ${failure}` : `BRZ_BACKUP_IMPORTED: ${file.name}`);
}

function clearBackup(): void {
  brz.removeImportedBackup();
  toast.push('BRZ_IMPORT_CLEARED: 已移除导入的快照');
}

async function rereadBrz(): Promise<void> {
  await brz.load();
  toast.push(
    brz.snapshot?.origin === 'indexeddb'
      ? 'BRZ_FUND_RELOADED: 已从 brz-fund 读取最新数据'
      : 'BRZ_FUND_UNAVAILABLE: 已退化为导入快照',
  );
}
</script>

<template>
  <section class="settings-group">
    <h3 class="settings-group__title">BRZ FUND</h3>
    <p class="settings-hint">
      数据来源：<strong>{{ brzSourceLabel }}</strong>
      <template v-if="brz.importMeta">
        · {{ brz.importMeta.fileName }}（{{ formatIsoLocal(brz.importMeta.importedAt) }}）
      </template>
    </p>
    <div class="option-row">
      <button type="button" class="sharp-btn" :disabled="importing" @click="pickBackup">
        {{ importing ? 'IMPORTING...' : 'IMPORT_BACKUP' }}
      </button>
      <button type="button" class="sharp-btn" @click="rereadBrz">RE_READ</button>
      <button v-if="brz.importMeta" type="button" class="sharp-btn" @click="clearBackup">
        CLEAR
      </button>
    </div>
    <p class="settings-hint">
      同源直读需要与 BRZ-Fund 部署在同一域名下；不同源时导入它的 JSON 备份。
    </p>

    <input
      ref="fileInput"
      type="file"
      accept="application/json,.json"
      class="sr-only"
      @change="onFileChange"
    />
  </section>
</template>
