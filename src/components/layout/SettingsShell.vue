<script setup lang="ts">
import { onBeforeUnmount, watch } from 'vue';

/** 应用级设置与各磁贴设置共用的弹窗外壳：遮罩、面板、ESC 关闭、锁滚动。 */
const props = defineProps<{ open: boolean; title: string; label?: string }>();
const emit = defineEmits<{ close: [] }>();

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && props.open) emit('close');
}

watch(
  () => props.open,
  (open) => {
    if (typeof document === 'undefined') return;
    document.body.style.overflow = open ? 'hidden' : '';
  },
);

if (typeof window !== 'undefined') {
  window.addEventListener('keydown', onKeydown);
  onBeforeUnmount(() => {
    window.removeEventListener('keydown', onKeydown);
    document.body.style.overflow = '';
  });
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="settings-overlay" role="presentation" @click.self="emit('close')">
      <section class="settings-panel" role="dialog" aria-modal="true" :aria-label="label ?? title">
        <header class="settings-panel__head">
          <h2 class="settings-panel__title">
            <span class="tile-dot" style="background: var(--accent)"></span>
            {{ title }}
          </h2>
          <button
            type="button"
            class="settings-panel__close"
            aria-label="关闭设置"
            @click="emit('close')"
          >
            [ESC]
          </button>
        </header>

        <div class="settings-panel__body">
          <slot />
        </div>

        <footer class="settings-panel__foot">
          <slot name="foot">所有设置都保存在本机浏览器，不会随仓库发布。</slot>
          <button type="button" class="text-link" @click="emit('close')">[CLOSE]</button>
        </footer>
      </section>
    </div>
  </Teleport>
</template>
