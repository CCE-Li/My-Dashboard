<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { normalizeHandle } from '@/services/codeforcesApi';
import { useBinanceStore } from '@/stores/useBinanceStore';
import { useBrzStore } from '@/stores/useBrzStore';
import { useCodeforcesStore } from '@/stores/useCodeforcesStore';
import { useLayoutStore } from '@/stores/useLayoutStore';
import { useSearchStore } from '@/stores/useSearchStore';
import { useThemeStore } from '@/stores/useThemeStore';
import { useToastStore } from '@/stores/useToastStore';
import { useUsageStore } from '@/stores/useUsageStore';
import { formatIsoLocal } from '@/utils/time';
import type { QuotaConfig } from '@/types/usage';

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ close: [] }>();

const themeStore = useThemeStore();
const searchStore = useSearchStore();
const codeforces = useCodeforcesStore();
const usage = useUsageStore();
const brz = useBrzStore();
const binance = useBinanceStore();
const layout = useLayoutStore();
const toast = useToastStore();

const cfDraft = ref('');
const keyDraft = ref('');
const revealKey = ref(false);
const quotaDraft = ref<QuotaConfig>({ tokens5h: 0, tokens24h: 0, creditUsd: 0 });
const bnKeyDraft = ref('');
const bnSecretDraft = ref('');
const revealSecret = ref(false);
const bnWatchlistDraft = ref('');
const bnTestResult = ref<{ ok: boolean; detail: string } | null>(null);
const importing = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);

/** 每次打开都把草稿重置为已保存的值，避免上次未提交的输入残留。 */
watch(
  () => props.open,
  (open) => {
    if (!open) return;
    cfDraft.value = codeforces.handle;
    keyDraft.value = usage.apiKey;
    revealKey.value = false;
    quotaDraft.value = { ...usage.quota };
    bnKeyDraft.value = binance.apiKey;
    bnSecretDraft.value = binance.apiSecret;
    bnWatchlistDraft.value = binance.watchlist.join(', ');
    bnTestResult.value = null;
    revealSecret.value = false;
  },
);

/** 打开时锁滚动，关闭时恢复。 */
watch(
  () => props.open,
  (open) => {
    if (typeof document === 'undefined') return;
    document.body.style.overflow = open ? 'hidden' : '';
  },
);

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && props.open) emit('close');
}

if (typeof window !== 'undefined') {
  window.addEventListener('keydown', onKeydown);
  onBeforeUnmount(() => {
    window.removeEventListener('keydown', onKeydown);
    document.body.style.overflow = '';
  });
}

const brzSourceLabel = computed(() => {
  if (brz.snapshot?.origin === 'indexeddb') return '同源直读 brz-fund';
  if (brz.snapshot?.origin === 'backup') return '导入的 JSON 快照';
  return '未接入';
});

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

function saveQuota(): void {
  usage.saveQuota(quotaDraft.value);
  quotaDraft.value = { ...usage.quota };
  toast.push('QUOTA_SAVED: 配额已保存到本机');
}

function saveBinance(): void {
  if (!bnKeyDraft.value.trim() || !bnSecretDraft.value.trim()) {
    toast.push('BINANCE_EMPTY: API key 与 secret 都要填');
    return;
  }
  binance.saveCredentials(bnKeyDraft.value, bnSecretDraft.value);
  toast.push('BINANCE_SAVED: 已保存到本机 localStorage');
}

async function testBinance(): Promise<void> {
  binance.saveCredentials(bnKeyDraft.value, bnSecretDraft.value);
  bnTestResult.value = await binance.testCredentials();
  toast.push(
    bnTestResult.value.ok
      ? 'BINANCE_OK: 鉴权通过'
      : `BINANCE_FAILED: ${bnTestResult.value.detail}`,
  );
}

function clearBinance(): void {
  binance.clearCredentials();
  bnKeyDraft.value = '';
  bnSecretDraft.value = '';
  bnTestResult.value = null;
  toast.push('BINANCE_CLEARED: 已从本机移除');
}

async function saveBinanceWatchlist(): Promise<void> {
  const invalid = await binance.validateSymbols(bnWatchlistDraft.value);
  if (invalid) {
    toast.push(`BINANCE_SYMBOLS: ${invalid}`);
    return;
  }
  binance.saveWatchlist(bnWatchlistDraft.value);
  bnWatchlistDraft.value = binance.watchlist.join(', ');
  toast.push('BINANCE_WATCHLIST_SAVED: 观察列表已保存');
}

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

function resetLayout(): void {
  layout.resetOrder();
  toast.push('LAYOUT_RESET: 已恢复默认磁贴顺序');
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="settings-overlay"
      role="presentation"
      @click.self="emit('close')"
    >
      <section
        class="settings-panel"
        role="dialog"
        aria-modal="true"
        aria-label="仪表盘设置"
      >
        <header class="settings-panel__head">
          <h2 class="settings-panel__title">
            <span class="tile-dot" style="background: var(--accent)"></span>
            SYSTEM_SETTINGS
          </h2>
          <button type="button" class="settings-panel__close" aria-label="关闭设置" @click="emit('close')">
            [ESC]
          </button>
        </header>

        <div class="settings-panel__body">
          <!-- 外观 -->
          <section class="settings-group">
            <h3 class="settings-group__title">外观 / THEME</h3>
            <div class="option-row">
              <button
                v-for="item in themeStore.themes"
                :key="item.id"
                type="button"
                class="option-chip"
                :class="{ 'option-chip--active': item.id === themeStore.themeId }"
                :aria-pressed="item.id === themeStore.themeId"
                :title="item.description"
                @click="themeStore.setTheme(item.id)"
              >
                [{{ item.label }}]
              </button>
            </div>
            <p class="settings-hint">{{ themeStore.theme.description }}</p>
          </section>

          <!-- 搜索平台 -->
          <section class="settings-group">
            <h3 class="settings-group__title">搜索平台 / SEARCH</h3>
            <div class="option-row">
              <button
                v-for="item in searchStore.platforms"
                :key="item.id"
                type="button"
                class="option-chip"
                :class="{ 'option-chip--active': item.id === searchStore.platformId }"
                :aria-pressed="item.id === searchStore.platformId"
                @click="searchStore.setPlatform(item.id)"
              >
                [{{ item.label }}]
              </button>
            </div>
            <p class="settings-hint">表单会提交到该平台的结果页，关键词参数自动适配。</p>
          </section>

          <!-- Codeforces -->
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
              <button
                type="button"
                class="sharp-btn"
                :disabled="codeforces.isBusy"
                @click="syncHandle"
              >
                {{ codeforces.isBusy ? 'SYNCING...' : 'SYNC' }}
              </button>
            </div>
            <p class="settings-hint">只保存在本机 localStorage，不会写进仓库。</p>
          </section>

          <!-- Command Code -->
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
              <button v-if="usage.hasApiKey" type="button" class="sharp-btn" @click="clearKey">
                CLEAR
              </button>
            </div>
            <p v-if="usage.keyCheck" class="settings-result">&gt; {{ usage.keyCheck.detail }}</p>
            <p class="settings-hint">
              官方 Provider API 没有读取用量的端点，key 仅用于鉴权验证；
              磁贴数字来自本地会话快照。
            </p>
          </section>

          <!-- 配额 -->
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

          <!-- 币安合约 -->
          <section class="settings-group">
            <h3 class="settings-group__title">BINANCE 合约 / U 本位</h3>

            <label class="field">
              <span class="field__label">
                API KEY
                <em v-if="binance.hasCredentials" class="field__saved">{{ binance.maskedKey }}</em>
                <em v-else class="field__unset">未配置</em>
              </span>
              <input
                v-model="bnKeyDraft"
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
                v-model="bnSecretDraft"
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

            <div class="option-row">
              <button type="button" class="sharp-btn" @click="saveBinance">SAVE</button>
              <button type="button" class="sharp-btn" @click="testBinance">TEST</button>
              <button
                v-if="binance.hasCredentials"
                type="button"
                class="sharp-btn"
                @click="clearBinance"
              >
                CLEAR
              </button>
            </div>

            <p
              v-if="bnTestResult"
              class="settings-result"
              :style="{ color: bnTestResult.ok ? 'var(--accent)' : 'var(--accent-pink)' }"
            >
              &gt; {{ bnTestResult.detail }}
            </p>

            <label class="field">
              <span class="field__label">观察列表（逗号分隔，最多 8 个）</span>
              <input
                v-model="bnWatchlistDraft"
                class="sharp-input"
                type="text"
                placeholder="BTCUSDT, ETHUSDT"
                spellcheck="false"
              />
            </label>
            <div class="option-row">
              <button type="button" class="sharp-btn" @click="saveBinanceWatchlist">
                保存观察列表
              </button>
            </div>

            <p class="settings-warn">
              ⚠️ secret 保存在本机 localStorage，并由浏览器直接签名请求。
              这意味着它对你的账户拥有完整权限：请务必使用<strong>只读</strong> key
              （关闭合约交易与提现）、配置 IP 白名单，且绝不要把 secret 提交到仓库。
              持仓数据只在你自己的浏览器里，不会上传到任何第三方。
            </p>
          </section>

          <!-- BRZ Fund -->
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
          </section>

          <!-- 布局 -->
          <section class="settings-group">
            <h3 class="settings-group__title">布局 / LAYOUT</h3>
            <div class="option-row">
              <button type="button" class="sharp-btn" @click="resetLayout">RESET_LAYOUT</button>
            </div>
            <p class="settings-hint">恢复默认磁贴顺序，拖动调整过的布局会被清掉。</p>
          </section>
        </div>

        <footer class="settings-panel__foot">
          <span>所有设置都保存在本机浏览器，不会随仓库发布。</span>
          <button type="button" class="text-link" @click="emit('close')">[CLOSE]</button>
        </footer>
      </section>

      <input
        ref="fileInput"
        type="file"
        accept="application/json,.json"
        class="sr-only"
        @change="onFileChange"
      />
    </div>
  </Teleport>
</template>

<style scoped>
.settings-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-4);
  /* 半透明 + 背景模糊：悬浮窗要透出后面的仪表盘 */
  background: color-mix(in srgb, var(--bg-base) 72%, transparent);
  backdrop-filter: blur(6px);
}

.settings-panel {
  display: flex;
  flex-direction: column;
  width: min(48rem, 100%);
  max-height: min(88vh, 52rem);
  background: color-mix(in srgb, var(--bg-surface) 88%, transparent);
  border: 1px solid var(--border-strong);
  box-shadow: 0 0 40px var(--accent-soft);
  backdrop-filter: blur(10px);
}

.settings-panel__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-4) var(--space-5);
  border-bottom: 1px solid var(--border);
}

.settings-panel__title {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin: 0;
  font-size: 0.75rem;
  letter-spacing: var(--tracking-wide);
  color: var(--text-primary);
}

.settings-panel__close {
  background: none;
  border: 1px solid var(--border-strong);
  color: var(--text-dim);
  font-family: inherit;
  font-size: 0.625rem;
  padding: 0.125rem 0.375rem;
  cursor: pointer;
}

.settings-panel__close:hover {
  color: var(--accent);
  border-color: var(--accent);
}

.settings-panel__body {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  padding: var(--space-5);
  overflow-y: auto;
}

.settings-panel__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-5);
  border-top: 1px solid var(--border);
  font-size: 0.5625rem;
  color: var(--text-faint);
}

.settings-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding-bottom: var(--space-4);
  border-bottom: 1px solid var(--border-subtle);
}

.settings-group:last-child {
  padding-bottom: 0;
  border-bottom: 0;
}

.settings-group__title {
  margin: 0;
  font-size: 0.625rem;
  font-weight: 400;
  letter-spacing: var(--tracking-wide);
  color: var(--text-faint);
}

.option-row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.option-chip {
  background: none;
  border: 1px solid var(--border-strong);
  color: var(--text-dim);
  font-family: inherit;
  font-size: 0.6875rem;
  letter-spacing: inherit;
  padding: 0.1875rem 0.375rem;
  cursor: pointer;
}

.option-chip:hover {
  color: var(--accent);
  border-color: var(--accent);
}

.option-chip--active {
  color: var(--accent);
  border-color: var(--accent);
  font-weight: 700;
}

.field {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.field__label {
  display: flex;
  align-items: baseline;
  gap: var(--space-2);
  font-size: 0.5625rem;
  color: var(--text-dim);
}

.field__saved {
  font-style: normal;
  color: var(--accent);
}

.field__unset {
  font-style: normal;
  color: var(--text-faint);
}

.checkbox {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  font-size: 0.5625rem;
  color: var(--text-faint);
  cursor: pointer;
}

.quota-fields {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
  gap: var(--space-2);
}

.settings-hint {
  margin: 0;
  font-size: 0.5625rem;
  line-height: 1.7;
  color: var(--text-faint);
}

.settings-hint strong {
  color: var(--text-dim);
}

.settings-warn {
  margin: 0;
  padding: var(--space-2);
  font-size: 0.5625rem;
  line-height: 1.7;
  color: var(--accent-pink);
  border-left: 2px solid var(--accent-pink);
}

.field__warn {
  font-style: normal;
  color: var(--warn);
}

.settings-result {
  margin: 0;
  font-size: 0.625rem;
  color: var(--accent);
  line-height: 1.5;
}

@media (max-width: 640px) {
  .settings-overlay {
    padding: 0;
  }

  .settings-panel {
    max-height: 100vh;
    height: 100%;
    width: 100%;
    border-left: 0;
    border-right: 0;
  }
}
</style>
