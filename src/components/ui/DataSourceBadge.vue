<script setup lang="ts">
import { computed } from 'vue';
import type { DataOrigin } from '@/types/dashboard';

const props = defineProps<{ origin: DataOrigin; label?: string }>();

const PRESET: Record<DataOrigin, { text: string; color: string }> = {
  live: { text: 'LIVE', color: 'var(--accent)' },
  cached: { text: 'CACHED', color: 'var(--accent-cyan)' },
  imported: { text: 'SNAPSHOT', color: 'var(--accent-purple)' },
  empty: { text: 'NO_DATA', color: 'var(--text-faint)' },
};

const presentation = computed(() => PRESET[props.origin]);
</script>

<template>
  <span class="origin-badge" :style="{ color: presentation.color }">
    [{{ label ?? presentation.text }}]
  </span>
</template>

<style scoped>
.origin-badge {
  font-size: 0.625rem;
  font-weight: 700;
  letter-spacing: var(--tracking-wide);
}
</style>
