import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';
import viteConfig from './vite.config.ts';

export default defineConfig({
  plugins: viteConfig.plugins ?? [],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    root: fileURLToPath(new URL('./', import.meta.url)),
    // domain/ 全是纯函数，无需 DOM 环境；将来加组件测试再换 jsdom
    environment: 'node',
    include: ['tests/**/*.spec.ts'],
    exclude: ['node_modules/**', 'dist/**'],
    clearMocks: true,
    restoreMocks: true,
  },
});
