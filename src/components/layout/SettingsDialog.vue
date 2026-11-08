<script setup lang="ts">
import SettingsShell from '@/components/layout/SettingsShell.vue';
import { useLayoutStore } from '@/stores/useLayoutStore';
import { useThemeStore } from '@/stores/useThemeStore';
import { useToastStore } from '@/stores/useToastStore';
import { TILES } from '@/tiles/registry';

/** 应用级设置：主题、磁贴显隐、布局。各磁贴自己的配置在各自的 TileSettingsDialog 里。 */
defineProps<{ open: boolean }>();
const emit = defineEmits<{ close: [] }>();

const themeStore = useThemeStore();
const layout = useLayoutStore();
const toast = useToastStore();

function resetLayout(): void {
  layout.resetLayout();
  toast.push('LAYOUT_RESET: 已恢复默认顺序与全部磁贴');
}
</script>

<template>
  <SettingsShell :open="open" title="SYSTEM_SETTINGS" label="仪表盘设置" @close="emit('close')">
    <!-- 外观 -->
    <section class="settings-group">
      <h3 class="settings-group__title">外观 / THEME</h3>
      <div class="option-row">
        <button
          v-for="item in themeStore.themes"
          :key="item.id"
          type="button"
          class="option-chip"
          :class="{ 'option-chip--active': item.id === themeStore.themeId }"
          :aria-pressed="item.id === themeStore.themeId"
          :title="item.description"
          @click="themeStore.setTheme(item.id)"
        >
          [{{ item.label }}]
        </button>
      </div>
      <p class="settings-hint">{{ themeStore.theme.description }}</p>
    </section>

    <!-- 磁贴显隐 -->
    <section class="settings-group">
      <h3 class="settings-group__title">磁贴 / TILES</h3>
      <div class="tile-toggles">
        <label v-for="tile in TILES" :key="tile.id" class="tile-toggle">
          <input
            type="checkbox"
            :checked="layout.isVisible(tile.id)"
            @change="layout.setVisible(tile.id, ($event.target as HTMLInputElement).checked)"
          />
          <span class="tile-toggle__label">{{ tile.label }}</span>
          <span class="tile-toggle__id">{{ tile.id }}</span>
        </label>
      </div>
      <p class="settings-hint">
        取消勾选即可从主界面隐藏该磁贴；顺序与配置都会保留，随时可以再勾回来。
        每块磁贴的具体配置在它自己的 [CONFIG] 里。
      </p>
    </section>

    <!-- 布局 -->
    <section class="settings-group">
      <h3 class="settings-group__title">布局 / LAYOUT</h3>
      <div class="option-row">
        <button type="button" class="sharp-btn" @click="resetLayout">RESET_LAYOUT</button>
      </div>
      <p class="settings-hint">恢复默认磁贴顺序并重新显示全部磁贴，拖动调整过的布局会被清掉。</p>
    </section>
  </SettingsShell>
</template>
