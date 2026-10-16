<script setup lang="ts">
withDefaults(
  defineProps<{
    /** 磁贴 id，用于拖拽落点识别 */
    tileId: string;
    title: string;
    /** 强调色，同时用于边线与状态点 */
    accent?: string;
    /** 强调边位置 */
    edge?: 'top' | 'left';
    /** 标题右侧的小字 */
    meta?: string;
  }>(),
  { accent: 'var(--accent)', edge: 'top', meta: '' },
);
</script>

<template>
  <section
    class="sharp-card tile-card"
    :class="[`sharp-card--${edge}`, 'draggable-tile', `tile-card--${tileId}`]"
    :style="{ '--card-accent': accent }"
    :data-id="tileId"
  >
    <header class="tile-card__head tile-divider">
      <h2 class="tile-title">
        <span class="drag-handle tile-card__handle" draggable="true" title="拖动调整顺序">::</span>
        <span class="tile-dot" :style="{ backgroundColor: accent }" aria-hidden="true"></span>
        <span>{{ title }}</span>
      </h2>
      <div class="tile-card__meta">
        <slot name="meta">{{ meta }}</slot>
      </div>
    </header>

    <div class="tile-card__body">
      <slot />
    </div>

    <footer v-if="$slots.footer" class="tile-card__foot tile-divider--top">
      <slot name="footer" />
    </footer>
  </section>
</template>

<style scoped>
.tile-card {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  height: 100%;
  padding: var(--space-5);
}

.tile-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}

.tile-card__meta {
  font-size: 0.625rem;
  color: var(--text-faint);
  font-family: var(--font-mono);
  text-transform: uppercase;
  white-space: nowrap;
}

.tile-card__handle {
  padding: 0 var(--space-1);
  font-weight: 700;
  color: var(--text-faint);
}

.tile-card__handle:hover {
  color: var(--text-primary);
}

.tile-card__body {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.tile-card__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  font-size: 0.625rem;
  color: var(--text-dim);
}
</style>
