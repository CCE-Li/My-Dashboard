<script setup lang="ts">
import { computed, ref } from 'vue';
import { useBinanceStore } from '@/stores/useBinanceStore';
import { useToastStore } from '@/stores/useToastStore';

const binance = useBinanceStore();
const toast = useToastStore();

const keyDraft = ref(binance.apiKey);
const secretDraft = ref(binance.apiSecret);
const revealSecret = ref(false);
const watchlistDraft = ref(binance.watchlist.join(', '));
const baseDraft = ref(binance.apiBase);
const testResult = ref<{ ok: boolean; detail: string } | null>(null);
const steps = ref<Array<{ step: string; ok: boolean; detail: string }>>([]);
const checking = ref(false);

const STEP_LABELS: Record<string, string> = {
  reachability: '1. 可达性',
  'public-read': '2. 公开读',
  auth: '3. 鉴权',
};

/** 本地预检：绝大多数 -2015 是这几类填错，先在发请求前拦住。 */
const precheck = computed(() => {
  const key = keyDraft.value.replace(/\s+/g, '');
  const secret = secretDraft.value.replace(/\s+/g, '');
  if (!key || !secret) return '';
  if (key === secret) return 'key 和 secret 填成了同一个值 —— 大概率填反或复制错了。';
  if (key.length !== 64) {
    return `币安 HMAC key 是 64 位，当前 ${key.length} 位 —— 可能少复制了一段。`;
  }
  if (secret.length !== 64) {
    return `secret 是 64 位，当前 ${secret.length} 位 —— 可能少复制了一段。`;
  }
  return '';
});

function save(): void {
  if (!keyDraft.value.trim() || !secretDraft.value.trim()) {
    toast.push('BINANCE_EMPTY: API key 与 secret 都要填');
    return;
  }
  binance.saveCredentials(keyDraft.value, secretDraft.value);
  toast.push('BINANCE_SAVED: 已保存到本机 localStorage');
}

async function test(): Promise<void> {
  binance.saveCredentials(keyDraft.value, secretDraft.value);
  keyDraft.value = binance.apiKey;
  secretDraft.value = binance.apiSecret;
  testResult.value = await binance.testCredentials();
  toast.push(
    testResult.value.ok ? 'BINANCE_OK: 鉴权通过' : `BINANCE_FAILED: ${testResult.value.detail}`,
  );
}

function clear(): void {
  binance.clearCredentials();
  keyDraft.value = '';
  secretDraft.value = '';
  testResult.value = null;
  toast.push('BINANCE_CLEARED: 已从本机移除');
}

async function saveWatchlist(): Promise<void> {
  const invalid = await binance.validateSymbols(watchlistDraft.value);
  if (invalid) {
    toast.push(`BINANCE_SYMBOLS: ${invalid}`);
    return;
  }
  binance.saveWatchlist(watchlistDraft.value);
  watchlistDraft.value = binance.watchlist.join(', ');
  toast.push('BINANCE_WATCHLIST_SAVED: 观察列表已保存');
}

function saveBase(): void {
  binance.saveApiBase(baseDraft.value);
  baseDraft.value = binance.apiBase;
  toast.push(`BINANCE_BASE_SAVED: ${binance.apiBase}`);
}

async function runSelfCheck(): Promise<void> {
  checking.value = true;
  binance.saveCredentials(keyDraft.value, secretDraft.value);
  binance.saveApiBase(baseDraft.value);
  baseDraft.value = binance.apiBase;
  try {
    steps.value = await binance.runSelfCheck();
  } finally {
    checking.value = false;
  }
}

async function copyEgressIp(): Promise<void> {
  const ip = binance.egressIp;
  if (!ip) return;
  try {
    await navigator.clipboard.writeText(ip);
    toast.push(`IP_COPIED: ${ip}`);
  } catch {
    toast.push('IP_COPY_FAILED: 浏览器拒绝了剪贴板访问，请手动选中复制');
  }
}
</script>

<template>
  <section class="settings-group">
    <h3 class="settings-group__title">BINANCE 合约 / U 本位</h3>

    <label class="field">
      <span class="field__label">
        API KEY
        <em v-if="binance.hasCredentials" class="field__saved">{{ binance.maskedKey }}</em>
        <em v-else class="field__unset">未配置</em>
      </span>
      <input
        v-model="keyDraft"
        class="sharp-input"
        type="password"
        placeholder="币安 API key"
        autocomplete="off"
        spellcheck="false"
      />
    </label>

    <label class="field">
      <span class="field__label">
        API SECRET
        <em class="field__warn">只读 key 请关闭交易与提现权限</em>
      </span>
      <input
        v-model="secretDraft"
        class="sharp-input"
        :type="revealSecret ? 'text' : 'password'"
        placeholder="币安 API secret"
        autocomplete="off"
        spellcheck="false"
      />
    </label>

    <label class="checkbox">
      <input v-model="revealSecret" type="checkbox" />
      <span>显示 secret 明文</span>
    </label>

    <p v-if="precheck" class="settings-warn">{{ precheck }}</p>

    <label class="field">
      <span class="field__label">
        API 地址
        <em class="field__unset">默认 https://fapi.binance.com</em>
      </span>
      <input
        v-model="baseDraft"
        class="sharp-input"
        type="text"
        placeholder="https://fapi.binance.com"
        spellcheck="false"
      />
    </label>
    <div class="option-row">
      <button type="button" class="sharp-btn" @click="saveBase">保存地址</button>
    </div>

    <div class="option-row">
      <button type="button" class="sharp-btn" @click="save">SAVE</button>
      <button type="button" class="sharp-btn" @click="test">TEST</button>
      <button type="button" class="sharp-btn" :disabled="checking" @click="runSelfCheck">
        {{ checking ? '检测中...' : '网络自检' }}
      </button>
      <button v-if="binance.hasCredentials" type="button" class="sharp-btn" @click="clear">
        CLEAR
      </button>
    </div>

    <p
      v-if="testResult"
      class="settings-result"
      :style="{ color: testResult.ok ? 'var(--accent)' : 'var(--accent-pink)' }"
    >
      &gt; {{ testResult.detail }}
    </p>

    <ul v-if="steps.length > 0" class="bn-steps">
      <li
        v-for="item in steps"
        :key="item.step"
        :style="{ color: item.ok ? 'var(--accent)' : 'var(--accent-pink)' }"
      >
        {{ STEP_LABELS[item.step] ?? item.step }} · {{ item.ok ? 'OK' : 'FAIL' }} ——
        {{ item.detail }}
      </li>
    </ul>

    <p v-if="binance.egressIp" class="settings-egress">
      本机出口 IP：<strong>{{ binance.egressIp }}</strong>
      <button
        type="button"
        class="text-link"
        title="把这个 IP 加到币安 API 的 IP 白名单里"
        @click="copyEgressIp"
      >
        [复制]
      </button>
      <br />
      <span class="settings-egress__hint">
        币安 -2015 的报错不会告诉你它看到的 IP，请用这个值填白名单；
        若你通过代理/VPN 访问币安，要填的是<strong>代理的出口 IP</strong>。
      </span>
    </p>

    <label class="field">
      <span class="field__label">观察列表（逗号分隔，最多 8 个）</span>
      <input
        v-model="watchlistDraft"
        class="sharp-input"
        type="text"
        placeholder="BTCUSDT, ETHUSDT"
        spellcheck="false"
      />
    </label>
    <div class="option-row">
      <button type="button" class="sharp-btn" @click="saveWatchlist">保存观察列表</button>
    </div>

    <p class="settings-warn">
      ⚠️ secret 保存在本机 localStorage，并由浏览器直接签名请求。
      这意味着它对你的账户拥有完整权限：请务必使用<strong>只读</strong> key
      （关闭合约交易与提现）、配置 IP 白名单，且绝不要把 secret 提交到仓库。
      持仓数据只在你自己的浏览器里，不会上传到任何第三方。
    </p>
  </section>
</template>
