<script setup lang="ts">
withDefaults(
  defineProps<{
    /** 0–100 */
    value: number;
    color?: string;
    height?: string;
  }>(),
  { color: 'var(--accent)', height: '10px' },
);
</script>

<template>
  <div class="pixel-bar" :style="{ height }">
    <div
      class="pixel-bar__fill"
      :style="{ width: `${Math.max(0, Math.min(100, value))}%`, backgroundColor: color }"
    ></div>
  </div>
</template>
