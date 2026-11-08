<script setup lang="ts">
import { computed } from 'vue';
import PixelBar from '@/components/ui/PixelBar.vue';
import { formatBytes, formatUptime, severityOf } from '@/domain/server';
import { useServerStore } from '@/stores/useServerStore';
import { formatPercent } from '@/utils/format';
import { formatIsoLocal } from '@/utils/time';

const store = useServerStore();
const view = computed(() => store.view);

const SEVERITY_COLOR: Record<string, string> = {
  ok: 'var(--accent)',
  warn: 'var(--warn)',
  critical: 'var(--accent-pink)',
};

function toneOf(percent: number): string {
  return SEVERITY_COLOR[severityOf(percent)] ?? 'var(--accent)';
}
</script>

<template>
  <section v-if="view" class="settings-group">
    <h3 class="settings-group__title">磁盘 / DISKS</h3>
    <div v-if="view.disks.length > 0" class="detail-disks">
      <div v-for="disk in view.disks" :key="disk.mount" class="detail-disk">
        <div class="detail-disk__head">
          <span class="metric-label">{{ disk.mount }}</span>
          <span class="detail-disk__value" :style="{ color: toneOf(disk.percent) }">
            {{ formatBytes(disk.usedBytes) }} / {{ formatBytes(disk.totalBytes) }} ·
            {{ formatPercent(disk.percent) }}
          </span>
        </div>
        <PixelBar :value="disk.percent" :color="toneOf(disk.percent)" />
      </div>
    </div>
    <p v-else class="settings-hint">端点未提供磁盘信息。</p>

    <h3 class="settings-group__title">系统 / SYSTEM</h3>
    <ul class="detail-meta">
      <li><span>主机名</span><b>{{ view.hostname }}</b></li>
      <li><span>平台</span><b>{{ view.platform }}</b></li>
      <li><span>运行时长</span><b>{{ formatUptime(view.uptimeSec) }}</b></li>
      <li><span>核心数</span><b>{{ view.cores }}</b></li>
      <li><span>负载 1/5/15</span><b>{{ view.loadAvg.join(' / ') || '—' }}</b></li>
      <li>
        <span>内存</span>
        <b>
          {{ formatBytes(view.memoryUsedBytes) }} / {{ formatBytes(view.memoryTotalBytes) }} ·
          {{ formatPercent(view.memoryPercent) }}
        </b>
      </li>
      <li><span>快照时间</span><b>{{ view.generatedAt ? formatIsoLocal(view.generatedAt) : '—' }}</b></li>
      <li><span>指标端点</span><b>{{ store.endpoint || '—' }}</b></li>
    </ul>
  </section>

  <p v-else class="settings-hint">
    还没有数据：先在磁贴的 [CONFIG] 里填好指标端点并同步，这里会列出全部磁盘与系统信息。
  </p>
</template>
