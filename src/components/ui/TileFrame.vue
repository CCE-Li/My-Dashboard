<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(
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
    /** 该磁贴所监控服务的官网主界面，给每个磁贴统一提供跳转入口 */
    siteUrl?: string;
    /** 官网名称，用于 tooltip 与无障碍标签 */
    siteLabel?: string;
  }>(),
  { accent: 'var(--accent)', edge: 'top', meta: '', siteUrl: '', siteLabel: '' },
);

const siteTitle = computed(() =>
  props.siteLabel ? `打开 ${props.siteLabel}` : '打开官网主界面',
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
        <a
          v-if="siteUrl"
          class="tile-site"
          :href="siteUrl"
          target="_blank"
          rel="noopener noreferrer"
          :title="siteTitle"
          :aria-label="siteTitle"
          >↗</a
        >
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
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  font-size: 0.625rem;
  color: var(--text-faint);
  font-family: var(--font-mono);
  text-transform: uppercase;
  white-space: nowrap;
}

/* 每个磁贴右上角的官网跳转入口 */
.tile-site {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.125rem;
  height: 1.125rem;
  border: 1px solid var(--border-strong);
  color: var(--text-dim);
  font-size: 0.625rem;
  font-weight: 700;
  line-height: 1;
  text-decoration: none;
  text-transform: none;
  transition:
    color var(--transition-instant),
    background-color var(--transition-instant),
    border-color var(--transition-instant);
}

.tile-site:hover {
  background: var(--card-accent, var(--accent));
  border-color: var(--card-accent, var(--accent));
  color: var(--on-accent);
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
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  font-size: 0.625rem;
  color: var(--text-dim);
}
</style>
