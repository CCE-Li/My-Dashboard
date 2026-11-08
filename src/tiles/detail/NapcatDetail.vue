<script setup lang="ts">
import { computed } from 'vue';
import type { NapcatHealth } from '@/types/napcat';
import { useNapcatStore } from '@/stores/useNapcatStore';
import { formatInteger } from '@/utils/format';
import { formatRelativeFromSeconds } from '@/utils/time';

const store = useNapcatStore();
const view = computed(() => store.view);

const HEALTH_TEXT: Record<NapcatHealth, string> = {
  online: '在线且正常',
  degraded: '在线，功能异常',
  offline: '未连接 QQ',
};

const ENDPOINTS = [
  '/get_status',
  '/get_version_info',
  '/get_login_info',
  '/get_friend_list',
  '/get_group_list',
];

const syncedLabel = computed(() =>
  store.fetchedAt ? formatRelativeFromSeconds(Math.floor(store.fetchedAt / 1000)) : '—',
);
</script>

<template>
  <section v-if="view" class="settings-group">
    <h3 class="settings-group__title">账号 / ACCOUNT</h3>
    <ul class="detail-meta">
      <li><span>昵称</span><b>{{ view.nickname }}</b></li>
      <li><span>QQ 号</span><b>{{ view.uin || '—' }}</b></li>
      <li>
        <span>好友 / 群</span>
        <b>{{ formatInteger(view.friendCount) }} / {{ formatInteger(view.groupCount) }}</b>
      </li>
      <li><span>状态</span><b>{{ HEALTH_TEXT[store.health] }}</b></li>
    </ul>

    <h3 class="settings-group__title">版本 / VERSION</h3>
    <ul class="detail-meta">
      <li><span>框架</span><b>{{ view.appName }}</b></li>
      <li><span>版本</span><b>{{ view.appVersion }}</b></li>
      <li><span>协议</span><b>OneBot {{ view.protocolVersion }}</b></li>
    </ul>

    <h3 class="settings-group__title">连接 / CONNECTION</h3>
    <ul class="detail-meta">
      <li><span>HTTP 地址</span><b>{{ store.baseUrl }}</b></li>
      <li><span>Access Token</span><b>{{ store.hasToken ? store.maskedToken : '未配置' }}</b></li>
      <li><span>上次同步</span><b>{{ syncedLabel }}</b></li>
    </ul>

    <h3 class="settings-group__title">只读端点 / ENDPOINTS</h3>
    <p class="settings-hint">{{ ENDPOINTS.join('  ·  ') }}</p>
  </section>

  <p v-else class="settings-hint">
    还没有数据：先在磁贴的 [CONFIG] 里填好 HTTP 地址与 access token 并同步。
  </p>
</template>
