<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { APP_CONFIG } from '@/config/app.config';
import { formatUtcClock } from '@/utils/time';

const emit = defineEmits<{ resetLayout: [] }>();

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
  color: #000000;
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
</style>
