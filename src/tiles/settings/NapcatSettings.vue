<script setup lang="ts">
import { ref } from 'vue';
import { useNapcatStore } from '@/stores/useNapcatStore';
import { useToastStore } from '@/stores/useToastStore';

const napcat = useNapcatStore();
const toast = useToastStore();

const baseDraft = ref(napcat.baseUrl);
const tokenDraft = ref(napcat.token);
const revealToken = ref(false);
const testResult = ref<{ ok: boolean; detail: string } | null>(null);

function save(): void {
  napcat.saveConfig(baseDraft.value, tokenDraft.value);
  baseDraft.value = napcat.baseUrl;
  tokenDraft.value = napcat.token;
  toast.push(`NAPCAT_SAVED: ${napcat.baseUrl}`);
}

async function test(): Promise<void> {
  napcat.saveConfig(baseDraft.value, tokenDraft.value);
  baseDraft.value = napcat.baseUrl;
  tokenDraft.value = napcat.token;
  testResult.value = await napcat.testConnection();
  toast.push(
    testResult.value.ok ? 'NAPCAT_OK: 连接成功' : `NAPCAT_FAILED: ${testResult.value.detail}`,
  );
}

function clearToken(): void {
  napcat.clearToken();
  tokenDraft.value = '';
  testResult.value = null;
  toast.push('NAPCAT_TOKEN_CLEARED: 已从本机移除');
}
</script>

<template>
  <section class="settings-group">
    <h3 class="settings-group__title">NAPCAT / BOT</h3>
    <label class="field">
      <span class="field__label">HTTP 地址</span>
      <input
        v-model="baseDraft"
        class="sharp-input"
        type="text"
        placeholder="http://127.0.0.1:3000"
        spellcheck="false"
      />
    </label>
    <label class="field">
      <span class="field__label">
        ACCESS TOKEN
        <em v-if="napcat.hasToken" class="field__saved">{{ napcat.maskedToken }}</em>
        <em v-else class="field__unset">未配置</em>
      </span>
      <input
        v-model="tokenDraft"
        class="sharp-input"
        :type="revealToken ? 'text' : 'password'"
        placeholder="OneBot access token（可留空）"
        autocomplete="off"
        spellcheck="false"
      />
    </label>
    <label class="checkbox">
      <input v-model="revealToken" type="checkbox" />
      <span>显示 token 明文</span>
    </label>
    <div class="option-row">
      <button type="button" class="sharp-btn" @click="save">SAVE</button>
      <button type="button" class="sharp-btn" @click="test">TEST</button>
      <button v-if="napcat.hasToken" type="button" class="sharp-btn" @click="clearToken">
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
    <p class="settings-hint">
      只读调用 get_status / get_version_info / get_login_info 与好友、群列表。
      token 只存本机 localStorage；NapCat 需允许跨域（或由本机反代）。
    </p>
  </section>
</template>
