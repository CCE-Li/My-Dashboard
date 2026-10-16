<script setup lang="ts">
import { computed, ref } from 'vue';
import { useLayoutStore } from '@/stores/useLayoutStore';
import { useToastStore } from '@/stores/useToastStore';
import { resolveTiles } from '@/tiles/registry';
import type { TileId } from '@/types/dashboard';

const layout = useLayoutStore();
const toast = useToastStore();

const tiles = computed(() => resolveTiles(layout.order));
const draggingId = ref<TileId | null>(null);
const overId = ref<TileId | null>(null);

function onDragStart(id: TileId, event: DragEvent): void {
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move';
    // Firefox 要求必须设置数据，否则拖拽不启动
    event.dataTransfer.setData('text/plain', id);
  }
  // 延后一帧再加类：让浏览器先拍下「干净」的拖拽快照，否则拖起来是半透明的
  setTimeout(() => {
    draggingId.value = id;
  }, 0);
}

function onDragEnd(): void {
  draggingId.value = null;
  overId.value = null;
}

function onDragEnter(id: TileId): void {
  if (draggingId.value && draggingId.value !== id) overId.value = id;
}

function onDragLeave(id: TileId): void {
  if (overId.value === id) overId.value = null;
}

function onDrop(id: TileId): void {
  const dragged = draggingId.value;
  overId.value = null;
  if (!dragged || dragged === id) return;
  layout.moveTile(dragged, id);
  toast.push('LAYOUT_SAVED: GRID_ORDER_UPDATED');
}
</script>

<template>
  <main id="tiles-grid" class="tile-grid shell__block">
    <div
      v-for="tile in tiles"
      :key="tile.id"
      class="tile-slot"
      :class="[
        `tile-slot--${tile.span}`,
        { dragging: draggingId === tile.id, 'drag-over': overId === tile.id },
      ]"
      @dragstart="onDragStart(tile.id, $event)"
      @dragend="onDragEnd"
      @dragover.prevent
      @dragenter.prevent="onDragEnter(tile.id)"
      @dragleave="onDragLeave(tile.id)"
      @drop.prevent="onDrop(tile.id)"
    >
      <component :is="tile.component" />
    </div>
  </main>
</template>

<style scoped>
.tile-slot {
  min-width: 0;
  display: flex;
}

.tile-slot > * {
  width: 100%;
}

.tile-slot.dragging > * {
  opacity: 0.3;
  border: 1px dashed var(--accent);
}

.tile-slot.drag-over > * {
  border-color: var(--accent) !important;
  background-color: var(--bg-hover-accent) !important;
}
</style>
