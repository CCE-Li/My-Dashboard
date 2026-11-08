<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useUiStore } from '@/stores/useUiStore';
import { getTileDefinition, isTileId } from '@/tiles/registry';

/**
 * 「穿越」详情弹窗：磁贴先向屏幕方向飞去，随后弹出这个放大版磁贴 + 详情区。
 * 内容取自注册表：component 放大显示，detail（可选）追加更多信息。
 */
const ui = useUiStore();

const active = computed(() => {
  const id = ui.detailTileId;
  return id !== null && isTileId(id) ? getTileDefinition(id) : null;
});

/** 延后到飞出动画差不多结束时再出现，衔接更顺 */
const shown = ref(false);
let timer: number | undefined;

function clearTimer(): void {
  if (timer !== undefined) {
    globalThis.clearTimeout(timer);
    timer = undefined;
  }
}

watch(
  () => ui.detailTileId,
  (id) => {
    clearTimer();
    if (id === null) {
      shown.value = false;
      return;
    }
    timer = globalThis.setTimeout(() => {
      if (ui.detailTileId !== null) shown.value = true;
    }, 360);
  },
);

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && ui.detailTileId !== null) ui.closeTileDetail();
}

watch(shown, (open) => {
  if (typeof document === 'undefined') return;
  document.body.style.overflow = open ? 'hidden' : '';
});

if (typeof window !== 'undefined') {
  window.addEventListener('keydown', onKeydown);
  onBeforeUnmount(() => {
    window.removeEventListener('keydown', onKeydown);
    clearTimer();
    document.body.style.overflow = '';
  });
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="shown && active"
      class="detail-overlay"
      role="presentation"
      @click.self="ui.closeTileDetail()"
    >
      <section
        class="detail-panel"
        role="dialog"
        aria-modal="true"
        :aria-label="`${active.label} 详情`"
      >
        <header class="settings-panel__head">
          <h2 class="settings-panel__title">
            <span class="tile-dot" style="background: var(--accent)"></span>
            {{ active.label }}
          </h2>
          <button
            type="button"
            class="settings-panel__close"
            aria-label="关闭详情"
            @click="ui.closeTileDetail()"
          >
            [ESC]
          </button>
        </header>

        <div class="detail-panel__body">
          <div class="detail-tile">
            <component :is="active.component" />
          </div>
          <component :is="active.detail" v-if="active.detail" />
        </div>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.detail-overlay {
  position: fixed;
  inset: 0;
  z-index: 1200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-4);
  background: color-mix(in srgb, var(--bg-base) 82%, transparent);
  backdrop-filter: blur(8px);
}

.detail-panel {
  display: flex;
  flex-direction: column;
  width: min(72rem, 96vw);
  max-height: 92vh;
  background: color-mix(in srgb, var(--bg-surface) 92%, transparent);
  border: 1px solid var(--border-strong);
  box-shadow: 0 0 60px var(--accent-soft);
  /* 回弹式入场，接住磁贴「飞来」的动量 */
  animation: detail-in 420ms cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes detail-in {
  from {
    opacity: 0;
    transform: scale(0.9) translateY(10px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

.detail-panel__body {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  padding: var(--space-5);
  overflow-y: auto;
}

.detail-tile {
  display: flex;
}

.detail-tile > * {
  width: 100%;
}
</style>
