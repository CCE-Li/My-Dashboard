<script setup lang="ts">
import { ref, watch } from 'vue';
import { createNoiseTile } from '@/utils/simplexNoise';

/**
 * Simplex 噪点背景层。
 *
 * 只在 simplex 主题下挂载：首次切到该主题时生成一次 512×512 纹理并缓存成 data URL，
 * 之后由 CSS 平铺/拉伸，不再逐帧计算 —— 颗粒是静态的，不会持续吃 CPU。
 */
const props = defineProps<{ active: boolean }>();

const textureUrl = ref<string | null>(null);

function generateTexture(): void {
  if (typeof document === 'undefined' || textureUrl.value) return;

  const canvas = document.createElement('canvas');
  const tile = createNoiseTile({ size: 512, frequency: 0.08, octaves: 2 });
  canvas.width = tile.size;
  canvas.height = tile.size;

  const context = canvas.getContext('2d');
  if (!context) return;

  const image = context.createImageData(tile.size, tile.size);
  image.data.set(tile.rgba);
  context.putImageData(image, 0, 0);

  textureUrl.value = canvas.toDataURL('image/png');
}

watch(
  () => props.active,
  (active) => {
    if (active) generateTexture();
  },
  { immediate: true },
);
</script>

<template>
  <div
    v-if="active && textureUrl"
    class="noise-backdrop"
    :style="{ backgroundImage: `url(${textureUrl})` }"
    aria-hidden="true"
  ></div>
</template>

<style scoped>
.noise-backdrop {
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  background-repeat: repeat;
  background-size: 512px 512px;
  opacity: var(--noise-opacity);
  /* 颗粒不做插值，保持锐利 */
  image-rendering: pixelated;
}
</style>
