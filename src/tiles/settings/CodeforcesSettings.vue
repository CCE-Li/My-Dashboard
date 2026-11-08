<script setup lang="ts">
import { ref } from 'vue';
import { normalizeHandle } from '@/services/codeforcesApi';
import { useCodeforcesStore } from '@/stores/useCodeforcesStore';
import { useToastStore } from '@/stores/useToastStore';

const codeforces = useCodeforcesStore();
const toast = useToastStore();

const cfDraft = ref(codeforces.handle);

function saveHandle(): void {
  const next = normalizeHandle(cfDraft.value);
  if (!next) {
    toast.push('HANDLE_EMPTY: 请输入 Codeforces handle');
    return;
  }
  codeforces.setHandle(next);
  cfDraft.value = next;
  toast.push(`HANDLE_SAVED: @${next}`);
  void codeforces.sync(true);
}

async function syncHandle(): Promise<void> {
  await codeforces.sync(true);
  toast.push(
    codeforces.state === 'ready'
      ? 'CF_API_SYNCED: 数据已刷新'
      : `CF_SYNC_FAILED: ${codeforces.error ?? '未知错误'}`,
  );
}
</script>

<template>
  <section class="settings-group">
    <h3 class="settings-group__title">CODEFORCES</h3>
    <label class="field">
      <span class="field__label">HANDLE</span>
      <input
        v-model="cfDraft"
        type="text"
        class="sharp-input"
        placeholder="your-handle"
        @keyup.enter="saveHandle"
      />
    </label>
    <div class="option-row">
      <button type="button" class="sharp-btn" @click="saveHandle">SAVE</button>
      <button type="button" class="sharp-btn" :disabled="codeforces.isBusy" @click="syncHandle">
        {{ codeforces.isBusy ? 'SYNCING...' : 'SYNC' }}
      </button>
    </div>
    <p class="settings-hint">只保存在本机 localStorage，不会写进仓库。</p>
  </section>
</template>
