<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useUiStore } from '@/stores/useUiStore';

/**
 * 鼠标「红绿灯」：指针移动时，把背景图里的白色路网按圆形范围填红。
 *
 * 行为：
 * - 有一个缓动「跟随点」按系数逼近光标，红点落在跟随点上 ——
 *   移动快时红点**追不上光标**，留下一条拖尾；
 * - 跟随点每走够 EMIT_STEP 才补一个红点；停下后跟随点收敛、不再补点，
 *   已有的红点在 TTL 内线性淡出 → 红色归零（鼠标不动就消失）。
 *
 * 只对「亮像素」生效靠亮度遮罩（mask-mode: luminance）+ 同一张背景图：
 * 路网是白的 → 显红，黑底与暗色建筑 → 基本透明。
 *
 * 性能：只有一层全屏元素，拖尾的多个圆在父层 mask-image 上按帧合成成
 * 一串 radial-gradient（默认 mask-composite: add，即并集）；红点放在固定
 * 长度的环形缓冲里，mask 字符串长度恒定有界。
 *
 * 层级：挂在 #app 内、z-index: -1 —— 位于背景图之上、磁贴内容之下。
 */
const ui = useUiStore();

/** 圆半径（px） */
const RADIUS = 130;
/** 单个红点从出现到完全消失的时间（ms） */
const TTL = 900;
/** 跟随点每帧向光标逼近的比例；越小越"追不上" */
const FOLLOW = 0.2;
/** 跟随点每走这么远才补一个红点，决定拖尾的疏密 */
const EMIT_STEP = RADIUS * 0.55;
/** 环形缓冲长度：略大于 TTL 内可能的补点数，让淡出不被覆盖打断 */
const SLOTS = 26;
const TRANSPARENT_MASK = 'linear-gradient(transparent, transparent)';

interface Point {
  x: number;
  y: number;
}

interface Blip extends Point {
  born: number;
}

const rootRef = ref<HTMLElement | null>(null);
const slots: Array<Blip | null> = new Array<Blip | null>(SLOTS).fill(null);

/** 光标位置（每次 pointermove 更新） */
let target: Point | null = null;
/** 缓动跟随点（每帧逼近 target） */
let lead: Point | null = null;
/** 上一个补点位置，用来判断跟随点是否已走够 EMIT_STEP */
let lastEmitPos: Point | null = null;
let cursor = 0;
let raf = 0;

function overlayOpen(): boolean {
  return ui.settingsOpen || ui.tileSettingsId !== null || ui.detailTileId !== null;
}

function writeMask(value: string): void {
  const el = rootRef.value;
  if (!el) return;
  el.style.setProperty('mask-image', value);
  el.style.setProperty('-webkit-mask-image', value);
}

function emit(x: number, y: number, now: number): void {
  slots[cursor] = { x, y, born: now };
  cursor = (cursor + 1) % SLOTS;
}

function tick(now: number): void {
  // 1) 跟随点逼近光标
  let chasing = false;
  if (target && lead) {
    const dx = target.x - lead.x;
    const dy = target.y - lead.y;
    if (Math.hypot(dx, dy) > 0.75) {
      lead.x += dx * FOLLOW;
      lead.y += dy * FOLLOW;
      chasing = true;
    } else {
      lead.x = target.x;
      lead.y = target.y;
    }
  }

  // 2) 跟随点走够一步就补一个红点（停在原地不会补 → 会淡出归零）
  if (lead) {
    const moved = lastEmitPos
      ? Math.hypot(lead.x - lastEmitPos.x, lead.y - lastEmitPos.y)
      : Number.POSITIVE_INFINITY;
    if (moved >= EMIT_STEP) {
      emit(lead.x, lead.y, now);
      lastEmitPos = { x: lead.x, y: lead.y };
    }
  }

  // 3) 组装拖尾 mask（顺带清理过期点）
  const parts: string[] = [];
  for (const blip of slots) {
    if (!blip) continue;
    const age = (now - blip.born) / TTL; // 0 → 1
    if (age >= 1) {
      blip.born = Number.NEGATIVE_INFINITY; // 标记为已过期
      continue;
    }
    const alpha = 1 - age;
    if (alpha <= 0.02) continue;
    const r = RADIUS * (0.85 + 0.15 * age);
    parts.push(
      `radial-gradient(circle ${r.toFixed(0)}px at ${blip.x.toFixed(0)}px ${blip.y.toFixed(0)}px, ` +
        `rgba(0,0,0,${alpha.toFixed(2)}) 0%, rgba(0,0,0,${alpha.toFixed(2)}) 55%, rgba(0,0,0,0) 100%)`,
    );
  }

  writeMask(parts.length > 0 ? parts.join(', ') : TRANSPARENT_MASK);

  if (chasing || parts.length > 0) {
    raf = globalThis.requestAnimationFrame(tick);
  } else {
    raf = 0;
  }
}

function onPointerMove(event: PointerEvent): void {
  if (overlayOpen()) return;

  target = { x: event.clientX, y: event.clientY };
  // 第一次（或离开后再进来）让跟随点直接落在光标上，避免跨屏连线
  if (!lead) {
    lead = { x: target.x, y: target.y };
    lastEmitPos = null;
  }
  if (raf === 0) raf = globalThis.requestAnimationFrame(tick);
}

function clear(): void {
  slots.fill(null);
  cursor = 0;
  target = null;
  lead = null;
  lastEmitPos = null;
  writeMask(TRANSPARENT_MASK);
  if (raf !== 0) {
    globalThis.cancelAnimationFrame(raf);
    raf = 0;
  }
}

/** 指针离开：停止追赶，已有的红点自然淡出；再进来重新起头 */
function onPointerLeave(): void {
  target = null;
  lead = null;
  lastEmitPos = null;
}

watch(overlayOpen, (open) => {
  if (open) clear();
});

onMounted(() => {
  writeMask(TRANSPARENT_MASK);
  globalThis.addEventListener('pointermove', onPointerMove, { passive: true });
  document.documentElement.addEventListener('pointerleave', onPointerLeave);
  globalThis.addEventListener('blur', clear);
});

onBeforeUnmount(() => {
  globalThis.removeEventListener('pointermove', onPointerMove);
  document.documentElement.removeEventListener('pointerleave', onPointerLeave);
  globalThis.removeEventListener('blur', clear);
  if (raf !== 0) globalThis.cancelAnimationFrame(raf);
});
</script>

<template>
  <div ref="rootRef" class="road-spot" aria-hidden="true">
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
  /* 初始不可见；拖尾的圆由 JS 写进 mask-image */
  mask-image: linear-gradient(transparent, transparent);
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
