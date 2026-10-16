import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  // 相对 base：GitHub Pages 子路径（https://cce-li.github.io/My-Dashboard/）与本地预览均可直接工作
  base: './',
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5174,
    // 本机同时跑 BRZ-Fund（5173）时避免抢占
    strictPort: false,
  },
  build: {
    target: 'es2022',
    sourcemap: false,
  },
});
