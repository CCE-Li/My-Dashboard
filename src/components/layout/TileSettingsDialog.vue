<script setup lang="ts">
import { computed } from 'vue';
import SettingsShell from '@/components/layout/SettingsShell.vue';
import { useUiStore } from '@/stores/useUiStore';
import { getTileDefinition, isTileId } from '@/tiles/registry';

/** 通用磁贴设置弹窗：内容取自注册表里该磁贴声明的 settings 组件。 */
const ui = useUiStore();

const active = computed(() => {
  const id = ui.tileSettingsId;
  return id !== null && isTileId(id) ? getTileDefinition(id) : null;
});
const settingsComponent = computed(() => active.value?.settings ?? null);
</script>

<template>
  <SettingsShell
    :open="settingsComponent !== null"
    :title="active ? `${active.label} // SETTINGS` : 'SETTINGS'"
    :label="active ? `${active.label} 设置` : '磁贴设置'"
    @close="ui.closeTileSettings()"
  >
    <component :is="settingsComponent" v-if="settingsComponent" />
  </SettingsShell>
</template>
