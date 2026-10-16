<script setup lang="ts">
import { computed, nextTick, ref } from 'vue';
import {
  computeFlipInverts,
  computePreviewShifts,
  findNearestTile,
  resolveDropTarget,
  type Point,
  type Rect,
} from '@/domain/tileLayout';
import { useLayoutStore } from '@/stores/useLayoutStore';
import { useToastStore } from '@/stores/useToastStore';
import { resolveTiles } from '@/tiles/registry';
import type { TileId } from '@/types/dashboard';

const layout = useLayoutStore();
const toast = useToastStore();

const tiles = computed(() => resolveTiles(layout.order));

const gridRef = ref<HTMLElement | null>(null);
/** 逻辑上的拖拽中磁贴（立即生效，驱动几何计算） */
const draggingId = ref<TileId | null>(null);
/** 视觉上的「空洞」状态，延后一帧生效，以免弄脏浏览器抓取的拖拽快照 */
const liftedId = ref<TileId | null>(null);
/** 拖动预览：需要让位的磁贴各自的位移 */
const shifts = ref<Record<string, Point>>({});
/** FLIP 反向位移，用于把「让位」状态平滑接到最终布局 */
const flips = ref<Record<string, Point>>({});
const noTransition = ref(false);

/**
 * 命中测试的外扩量。网格间距是 20px，向外扩 14px 意味着光标还在缝隙里时
 * 就已经归属到最近的磁贴 —— 拖动感知会明显灵敏。
 */
const TARGET_MARGIN_PX = 14;

/** 拖动开始时的位置快照；拖动期间不改 DOM，所以快照全程有效 */
let rectSnapshot = new Map<TileId, Rect>();
/** 网格自身的边界：只有在这个范围内松手才算有效落点 */
let gridBounds: Rect | null = null;
let activeTargetId: TileId | null = null;
let committed = false;

function measure(): Map<TileId, Rect> {
  const result = new Map<TileId, Rect>();
  gridRef.value?.querySelectorAll<HTMLElement>('[data-tile-id]').forEach((node) => {
    const id = node.dataset.tileId as TileId | undefined;
    if (!id) return;
    const rect = node.getBoundingClientRect();
    result.set(id, { x: rect.left, y: rect.top, width: rect.width, height: rect.height });
  });
  return result;
}

/** 只看左上角坐标的子集，供纯几何函数使用 */
function toPoints(source: Map<TileId, Rect>): Map<TileId, Point> {
  const points = new Map<TileId, Point>();
  source.forEach((rect, id) => points.set(id, { x: rect.x, y: rect.y }));
  return points;
}

function toRecord(source: Map<string, Point>): Record<string, Point> {
  const record: Record<string, Point> = {};
  source.forEach((point, id) => {
    record[id] = point;
  });
  return record;
}

function pointerOf(event: DragEvent): Point {
  return { x: event.clientX, y: event.clientY };
}

function isInsideGrid(pointer: Point): boolean {
  if (!gridBounds) return false;
  return (
    pointer.x >= gridBounds.x &&
    pointer.x <= gridBounds.x + gridBounds.width &&
    pointer.y >= gridBounds.y &&
    pointer.y <= gridBounds.y + gridBounds.height
  );
}

/**
 * 落点解析：先做带外扩量的命中测试（缝隙归最近的邻居），
 * 命中不到但仍在网格范围内时兜底到最近的磁贴。
 *
 * 兜底这一层是必需的：网格里必然存在空白（最后一行的空列），
 * 没有兜底的话拖到那里松手等于白拖 —— 这正是「有时候拖动不生效」的原因。
 */
function resolveTargetAt(pointer: Point): TileId | null {
  const hit = resolveDropTarget(rectSnapshot, pointer, TARGET_MARGIN_PX);
  if (hit) return hit as TileId;
  if (!isInsideGrid(pointer)) return null;
  return findNearestTile(rectSnapshot, pointer) as TileId | null;
}

function slotStyle(id: TileId): Record<string, string> {
  const offset = flips.value[id] ?? shifts.value[id];
  if (!offset) return {};
  if (Math.abs(offset.x) < 0.5 && Math.abs(offset.y) < 0.5) return {};
  return { transform: `translate3d(${offset.x}px, ${offset.y}px, 0)` };
}

function onDragStart(id: TileId): void {
  draggingId.value = id;
  activeTargetId = null;
  committed = false;
  shifts.value = {};
  flips.value = {};
  rectSnapshot = measure();
  const bounds = gridRef.value?.getBoundingClientRect();
  gridBounds = bounds
    ? { x: bounds.left, y: bounds.top, width: bounds.width, height: bounds.height }
    : null;

  // 延后一帧再加「空洞」样式：浏览器在 dragstart 当帧抓取拖拽快照，
  // 同步加上的话快照里会是虚线空洞而不是完整的磁贴
  setTimeout(() => {
    if (draggingId.value === id) liftedId.value = id;
  }, 0);
}

/**
 * 用指针位置而不是 dragenter 来决定落点：dragenter 只在光标真正进入元素时才触发，
 * 而磁贴之间有间距，走在缝上会毫无反应。这里每次 dragover 都重新命中测试，
 * 光标一越过边界就让位。
 */
function onGridDragOver(event: DragEvent): void {
  const dragged = draggingId.value;
  if (!dragged) return;

  const target = resolveTargetAt(pointerOf(event));
  if (target === activeTargetId) return;
  activeTargetId = target;

  if (!target || target === dragged) {
    // 回到自己身上或离开网格 → 收起让位
    shifts.value = {};
    return;
  }

  shifts.value = toRecord(
    computePreviewShifts(layout.order, toPoints(rectSnapshot), dragged, target),
  );
}

async function commitDrop(target: TileId): Promise<void> {
  const dragged = draggingId.value;
  if (!dragged || dragged === target) {
    onDragEnd();
    return;
  }
  committed = true;

  // 先量下「带让位位移」的真实视觉位置，作为 FLIP 的起点
  const before = measure();
  const beforePoints = toPoints(before);
  shifts.value = {};
  flips.value = {};
  layout.moveTile(dragged, target);
  await nextTick();

  const inverts = computeFlipInverts(layout.order, beforePoints, toPoints(measure()));
  if (inverts.size > 0) {
    noTransition.value = true;
    flips.value = toRecord(inverts);
    await nextTick();
    // 关掉过渡并贴上反向位移（此时视觉位置不变），下一帧开启过渡滑向终点
    requestAnimationFrame(() => {
      noTransition.value = false;
      flips.value = {};
    });
  }

  onDragEnd();
  toast.push('LAYOUT_SAVED: GRID_ORDER_UPDATED');
}

function onGridDrop(event: DragEvent): void {
  const dragged = draggingId.value;
  if (!dragged) {
    onDragEnd();
    return;
  }
  const target = resolveTargetAt(pointerOf(event));
  if (!target || target === dragged) {
    onDragEnd();
    return;
  }
  void commitDrop(target);
}

function onDragEnd(): void {
  draggingId.value = null;
  liftedId.value = null;
  activeTargetId = null;
  if (!committed) {
    // 没落成（拖到空白处/按了 Esc）：清掉预览位移，
    // 由 CSS 过渡把磁贴平滑送回原位
    shifts.value = {};
  }
  committed = false;
}
</script>

<template>
  <main
    id="tiles-grid"
    ref="gridRef"
    class="tile-grid shell__block"
    :class="{ 'tile-grid--settling': noTransition }"
    @dragover.prevent="onGridDragOver"
    @drop.prevent="onGridDrop"
  >
    <div
      v-for="tile in tiles"
      :key="tile.id"
      class="tile-slot"
      :class="[`tile-slot--${tile.span}`, { 'tile-slot--lifted': liftedId === tile.id }]"
      :style="slotStyle(tile.id)"
      :data-tile-id="tile.id"
      @dragstart="onDragStart(tile.id)"
      @dragend="onDragEnd"
    >
      <component :is="tile.component" />
    </div>
  </main>
</template>

<style scoped>
.tile-slot {
  min-width: 0;
  display: flex;
  /* 让位与归位都走同一条缓动曲线；时间压到 160ms 让响应更跟手 */
  transition: transform 160ms cubic-bezier(0.22, 1, 0.36, 1);
  will-change: transform;
}

.tile-slot > * {
  width: 100%;
  transition:
    opacity 130ms ease,
    transform 130ms ease;
}

/* 拖拽中：落点上留一个虚线「空洞」，让人看清会落在哪里 */
.tile-slot--lifted > * {
  opacity: 0.32;
  border: 1px dashed var(--card-accent, var(--accent));
  transform: scale(0.97);
}

/* 贴反向位移的那一帧必须关掉过渡，否则会先动一下再滑回来 */
.tile-grid--settling .tile-slot {
  transition: none;
}

@media (prefers-reduced-motion: reduce) {
  .tile-slot,
  .tile-slot > * {
    transition: none;
  }
}
</style>
