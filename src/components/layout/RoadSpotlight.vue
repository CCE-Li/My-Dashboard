<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useUiStore } from '@/stores/useUiStore';

/**
 * 鼠标「红绿灯」：跟随指针的圆形范围内，把背景图里的白色路网填红；
 * 指针离开或打开任何弹窗时，整体淡出（CSS opacity 过渡）。
 *
 * 层级：挂在 #app 内、z-index: -1 —— 位于 body::before 的背景图之上、
 * 磁贴内容之下，所以只在背景露出来的地方可见。
 *
 * 只对「亮像素」生效靠亮度遮罩（mask-mode: luminance）+ 同一张背景图：
 * 路网是白的 → 显红，黑底与暗色建筑 → 基本透明。不支持 mask-mode 的浏览器
 * 会整块隐藏（见下方 @supports），不会退化成一大片红。
 */
const ui = useUiStore();

/** 圆形半径（px） */
const RADIUS = 170;

const x = ref(0);
const y = ref(0);
const active = ref(false);

let raf = 0;
let next: { x: number; y: number } | null = null;

function flush(): void {
  raf = 0;
  if (!next) return;
  x.value = next.x;
  y.value = next.y;
  next = null;
}

function onPointerMove(event: PointerEvent): void {
  next = { x: event.clientX, y: event.clientY };
  if (raf === 0) raf = globalThis.requestAnimationFrame(flush);
  active.value = true;
}

function onPointerLeave(): void {
  active.value = false;
}

const overlayOpen = computed(
  () => ui.settingsOpen || ui.tileSettingsId !== null || ui.detailTileId !== null,
);

const style = computed(() => ({
  '--spot-x': `${x.value}px`,
  '--spot-y': `${y.value}px`,
  '--spot-r': `${RADIUS}px`,
  opacity: active.value && !overlayOpen.value ? '1' : '0',
}));

onMounted(() => {
  globalThis.addEventListener('pointermove', onPointerMove, { passive: true });
  document.documentElement.addEventListener('pointerleave', onPointerLeave);
  globalThis.addEventListener('blur', onPointerLeave);
});

onBeforeUnmount(() => {
  globalThis.removeEventListener('pointermove', onPointerMove);
  document.documentElement.removeEventListener('pointerleave', onPointerLeave);
  globalThis.removeEventListener('blur', onPointerLeave);
  if (raf !== 0) globalThis.cancelAnimationFrame(raf);
});
</script>

<template>
  <div class="road-spot" :style="style" aria-hidden="true">
    <div class="road-spot__fill" />
  </div>
</template>

<style scoped>
/* 不支持亮度遮罩就整体不显示，避免退化成一大片红 */
.road-spot {
  display: none;
}

@supports (mask-mode: luminance) {
  .road-spot {
    display: block;
  }
}

.road-spot {
  position: fixed;
  inset: 0;
  /* -1：在 #app 上下文里，位于内容之下、body::before 的背景图之上 */
  z-index: -1;
  pointer-events: none;
  opacity: 0;
  /* 指针移开后「慢慢消失」 */
  transition: opacity 900ms ease-out;
  -webkit-mask-image: radial-gradient(
    circle var(--spot-r) at var(--spot-x) var(--spot-y),
    #000 0%,
    #000 55%,
    transparent 100%
  );
  mask-image: radial-gradient(
    circle var(--spot-r) at var(--spot-x) var(--spot-y),
    #000 0%,
    #000 55%,
    transparent 100%
  );
}

/* 用同一张地图做亮度遮罩：亮像素（路网）显红，黑底透明 */
.road-spot__fill {
  position: absolute;
  inset: 0;
  background-color: var(--road-spot-color);
  -webkit-mask-image: var(--road-spot-mask);
  mask-image: var(--road-spot-mask);
  -webkit-mask-mode: luminance;
  mask-mode: luminance;
  -webkit-mask-size: cover;
  mask-size: cover;
  -webkit-mask-position: center;
  mask-position: center;
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
}
</style>
