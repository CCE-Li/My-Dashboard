<script setup lang="ts">
import { computed } from 'vue';
import AppFooter from '@/components/layout/AppFooter.vue';
import NoiseBackdrop from '@/components/layout/NoiseBackdrop.vue';
import SettingsDialog from '@/components/layout/SettingsDialog.vue';
import StatusHeader from '@/components/layout/StatusHeader.vue';
import TileGrid from '@/components/layout/TileGrid.vue';
import ToastHost from '@/components/layout/ToastHost.vue';
import { useThemeStore } from '@/stores/useThemeStore';
import { useUiStore } from '@/stores/useUiStore';

const themeStore = useThemeStore();
const ui = useUiStore();

/** 噪点层只在 simplex 主题下挂载，并且只生成一次纹理 */
const noiseActive = computed(() => themeStore.themeId === 'simplex');
</script>

<template>
  <NoiseBackdrop :active="noiseActive" />
  <div class="shell">
    <StatusHeader />
    <TileGrid />
    <AppFooter />
  </div>
  <SettingsDialog :open="ui.settingsOpen" @close="ui.closeSettings()" />
  <ToastHost />
</template>
