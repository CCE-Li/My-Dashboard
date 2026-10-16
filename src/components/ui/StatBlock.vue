<script setup lang="ts">
defineProps<{ label: string; value: string; tone?: string; note?: string }>();
</script>

<template>
  <div class="stat-block">
    <div class="metric-label">{{ label }}</div>
    <div class="stat-block__value" :style="{ color: tone ?? 'var(--text-primary)' }">{{ value }}</div>
    <div v-if="note" class="stat-block__note">{{ note }}</div>
  </div>
</template>

<style scoped>
.stat-block {
  background: var(--bg-sunken);
  border: 1px solid var(--border);
  padding: 0.625rem;
  min-width: 0;
}

.stat-block__value {
  font-family: var(--font-mono);
  font-size: 1.25rem;
  font-weight: 700;
  margin-top: 0.125rem;
}

.stat-block__note {
  font-size: 0.5625rem;
  color: var(--text-faint);
  margin-top: var(--space-1);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
