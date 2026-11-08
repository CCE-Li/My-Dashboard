<script setup lang="ts">
import { ref } from 'vue';
import { useToastStore } from '@/stores/useToastStore';
import { useUsageStore } from '@/stores/useUsageStore';
import type { QuotaConfig } from '@/types/usage';

const usage = useUsageStore();
const toast = useToastStore();

const quotaDraft = ref<QuotaConfig>({ ...usage.quota });

function saveQuota(): void {
  usage.saveQuota(quotaDraft.value);
  quotaDraft.value = { ...usage.quota };
  toast.push('QUOTA_SAVED: 配额已保存到本机');
}
</script>

<template>
  <section class="settings-group">
    <h3 class="settings-group__title">配额 / QUOTA</h3>
    <div class="quota-fields">
      <label class="field">
        <span class="field__label">5H TOKENS</span>
        <input v-model.number="quotaDraft.tokens5h" type="number" min="0" class="sharp-input" />
      </label>
      <label class="field">
        <span class="field__label">24H TOKENS</span>
        <input v-model.number="quotaDraft.tokens24h" type="number" min="0" class="sharp-input" />
      </label>
      <label class="field">
        <span class="field__label">总充值 (USD)</span>
        <input
          v-model.number="quotaDraft.creditUsd"
          type="number"
          min="0"
          step="0.01"
          class="sharp-input"
        />
      </label>
    </div>
    <div class="option-row">
      <button type="button" class="sharp-btn" @click="saveQuota">SAVE</button>
    </div>
    <p class="settings-hint">
      进度条的分母只能手填：官方没有额度查询接口。填 0 表示不显示该条。
    </p>
  </section>
</template>
