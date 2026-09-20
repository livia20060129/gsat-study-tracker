import { defineConfig, loadEnv, type ConfigEnv, type UserConfig } from 'vite';

import { assertSafeViteEnvironment } from './src/config/publicEnvironment.ts';

function createViteConfig({ mode }: ConfigEnv): UserConfig {
  assertSafeViteEnvironment(loadEnv(mode, process.cwd(), ''));
  return {
    base: './',
    build: {
      rollupOptions: {
        input: {
          tracker: './index.html',
          learningSummary: './summary.html',
          materialProgress: './material.progress.html',
        },
      },
    },
  };
}

export default defineConfig(createViteConfig);
