<script setup lang="ts">
import { ref } from 'vue';
import { useToastStore } from '@/stores/useToastStore';
import { useUsageStore } from '@/stores/useUsageStore';

const usage = useUsageStore();
const toast = useToastStore();

const keyDraft = ref(usage.apiKey);
const revealKey = ref(false);

function saveKey(): void {
  if (!keyDraft.value.trim()) {
    toast.push('API_KEY_EMPTY: 请输入 API key');
    return;
  }
  usage.saveApiKey(keyDraft.value);
  keyDraft.value = usage.apiKey;
  toast.push('API_KEY_SAVED: 已保存到本机 localStorage');
}

async function testKey(): Promise<void> {
  await usage.checkApiKey();
  toast.push(
    usage.keyCheck?.status === 'valid'
      ? 'API_KEY_VALID: 鉴权通过'
      : `API_KEY_CHECK: ${usage.keyCheck?.detail ?? '未知结果'}`,
  );
}

function clearKey(): void {
  usage.clearApiKey();
  keyDraft.value = '';
  toast.push('API_KEY_CLEARED: 已从本机移除');
}
</script>

<template>
  <section class="settings-group">
    <h3 class="settings-group__title">COMMAND CODE</h3>
    <label class="field">
      <span class="field__label">
        API KEY
        <em v-if="usage.hasApiKey" class="field__saved">{{ usage.maskedApiKey }}</em>
        <em v-else class="field__unset">未配置</em>
      </span>
      <input
        v-model="keyDraft"
        class="sharp-input"
        :type="revealKey ? 'text' : 'password'"
        placeholder="user_..."
        autocomplete="off"
        spellcheck="false"
      />
    </label>
    <label class="checkbox">
      <input v-model="revealKey" type="checkbox" />
      <span>显示明文</span>
    </label>
    <div class="option-row">
      <button type="button" class="sharp-btn" @click="saveKey">SAVE</button>
      <button
        type="button"
        class="sharp-btn"
        :disabled="!usage.hasApiKey || usage.checkingKey"
        @click="testKey"
      >
        {{ usage.checkingKey ? 'TESTING...' : 'TEST' }}
      </button>
      <button v-if="usage.hasApiKey" type="button" class="sharp-btn" @click="clearKey">CLEAR</button>
    </div>
    <p v-if="usage.keyCheck" class="settings-result">&gt; {{ usage.keyCheck.detail }}</p>
    <p class="settings-hint">
      官方 Provider API 没有读取用量的端点，key 仅用于鉴权验证；磁贴数字来自本地会话快照。
    </p>
  </section>
</template>
