<script setup lang="ts">
import AppFooter from '@/components/layout/AppFooter.vue';
import StatusHeader from '@/components/layout/StatusHeader.vue';
import TileGrid from '@/components/layout/TileGrid.vue';
import ToastHost from '@/components/layout/ToastHost.vue';
import { useLayoutStore } from '@/stores/useLayoutStore';
import { useToastStore } from '@/stores/useToastStore';

const layout = useLayoutStore();
const toast = useToastStore();

function resetLayout(): void {
  layout.resetOrder();
  toast.push('LAYOUT_RESET: 已恢复默认磁贴顺序');
}
</script>

<template>
  <div class="shell">
    <StatusHeader @reset-layout="resetLayout" />
    <TileGrid />
    <AppFooter />
  </div>
  <ToastHost />
</template>
