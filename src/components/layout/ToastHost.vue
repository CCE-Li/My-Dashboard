<script setup lang="ts">
import { useToastStore } from '@/stores/useToastStore';

const toast = useToastStore();
</script>

<template>
  <div class="toast-host" aria-live="polite">
    <div v-for="message in toast.messages" :key="message.id" class="toast-host__item">
      <span class="toast-host__caret">&gt;</span>
      <span>{{ message.text }}</span>
    </div>
  </div>
</template>

<style scoped>
.toast-host {
  position: fixed;
  right: var(--space-4);
  bottom: var(--space-4);
  z-index: 50;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  align-items: flex-end;
}

.toast-host__item {
  background: var(--bg-surface);
  border: 1px solid var(--accent);
  color: var(--text-primary);
  padding: var(--space-3);
  font-size: 0.75rem;
  font-family: var(--font-mono);
  max-width: min(24rem, 80vw);
}

.toast-host__caret {
  color: var(--accent);
}
</style>
