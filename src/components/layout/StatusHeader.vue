<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { APP_CONFIG } from '@/config/app.config';
import { useThemeStore } from '@/stores/useThemeStore';
import { formatUtcClock } from '@/utils/time';

const emit = defineEmits<{ resetLayout: [] }>();

const themeStore = useThemeStore();

const clock = ref(formatUtcClock());
let timer: number | undefined;

onMounted(() => {
  timer = globalThis.setInterval(() => {
    clock.value = formatUtcClock();
  }, APP_CONFIG.clockIntervalMs);
});

onBeforeUnmount(() => {
  if (timer !== undefined) globalThis.clearInterval(timer);
});
</script>

<template>
  <header class="status-header shell__block tile-divider">
    <div class="status-header__brand">
      <span class="status-header__chip">[SYS.RAW]</span>
      <span class="status-header__title">
        {{ APP_CONFIG.productName }} // DRAGGABLE_TILES_{{ APP_CONFIG.version }}
      </span>
    </div>

    <div class="status-header__right">
      <div class="theme-picker" role="group" aria-label="主题">
        <span class="theme-picker__label">THEME:</span>
        <button
          v-for="item in themeStore.themes"
          :key="item.id"
          type="button"
          class="theme-picker__option"
          :class="{ 'theme-picker__option--active': item.id === themeStore.themeId }"
          :aria-pressed="item.id === themeStore.themeId"
          :title="item.description"
          @click="themeStore.setTheme(item.id)"
        >
          [{{ item.label }}]
        </button>
      </div>

      <span>MODE: <span class="status-header__mode">EDITABLE_GRID</span></span>
      <button type="button" class="text-link" @click="emit('resetLayout')">[RESET_LAYOUT]</button>
      <span class="status-header__clock">{{ clock }}</span>
    </div>
  </header>
</template>

<style scoped>
.status-header {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-2);
  font-size: 0.75rem;
}

@media (min-width: 640px) {
  .status-header {
    flex-direction: row;
    align-items: center;
  }
}

.status-header__brand {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.status-header__chip {
  background: var(--accent);
  color: var(--on-accent);
  font-weight: 700;
  padding: 0.125rem 0.375rem;
}

.status-header__title {
  color: var(--text-primary);
  font-weight: 700;
  letter-spacing: var(--tracking-wide);
}

.status-header__right {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-4);
  color: var(--text-dim);
  font-family: var(--font-mono);
}

.status-header__mode {
  color: var(--accent);
}

.status-header__clock {
  color: var(--text-primary);
  background: var(--bg-raised);
  border: 1px solid var(--border-strong);
  padding: 0.125rem 0.5rem;
}

.theme-picker {
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-1);
}

.theme-picker__label {
  color: var(--text-faint);
  margin-right: var(--space-1);
}

.theme-picker__option {
  background: none;
  border: 1px solid transparent;
  color: var(--text-dim);
  font-family: inherit;
  font-size: 0.6875rem;
  letter-spacing: inherit;
  padding: 0.0625rem 0.25rem;
  cursor: pointer;
  transition:
    color var(--transition-instant),
    border-color var(--transition-instant);
}

.theme-picker__option:hover {
  color: var(--accent);
  border-color: var(--border-strong);
}

.theme-picker__option--active {
  color: var(--accent);
  border-color: var(--accent);
  font-weight: 700;
}
</style>
