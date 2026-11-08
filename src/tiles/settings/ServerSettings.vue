<script setup lang="ts">
import { ref } from 'vue';
import { useServerStore } from '@/stores/useServerStore';
import { useToastStore } from '@/stores/useToastStore';

const server = useServerStore();
const toast = useToastStore();

const endpointDraft = ref(server.endpoint);

function saveEndpoint(): void {
  server.saveEndpoint(endpointDraft.value);
  endpointDraft.value = server.endpoint;
  toast.push(
    server.isConfigured
      ? `SERVER_ENDPOINT_SAVED: ${server.endpoint}`
      : 'SERVER_ENDPOINT_CLEARED: 已清空端点',
  );
  void server.sync();
}
</script>

<template>
  <section class="settings-group">
    <h3 class="settings-group__title">服务器 / SERVER</h3>
    <label class="field">
      <span class="field__label">指标端点地址</span>
      <input
        v-model="endpointDraft"
        class="sharp-input"
        type="text"
        placeholder="https://your-host/metrics"
        spellcheck="false"
        @keyup.enter="saveEndpoint"
      />
    </label>
    <div class="option-row">
      <button type="button" class="sharp-btn" @click="saveEndpoint">SAVE</button>
    </div>
    <p class="settings-hint">
      端点需返回本仓库约定的 JSON 指标结构（见 README 与
      <code>scripts/server-metrics-agent.mjs</code>）。浏览器直连要求端点带 CORS 头；
      https 页面不能请求 http 端点（混合内容会被拦截）。
    </p>
  </section>
</template>
