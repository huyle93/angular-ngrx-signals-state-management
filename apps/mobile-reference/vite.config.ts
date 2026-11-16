import { defineConfig } from 'vitest/config';
import angular from '@analogjs/vite-plugin-angular';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
export default defineConfig({
  root: __dirname,
  plugins: [angular({ tsconfig: 'tsconfig.spec.json' }), nxViteTsPaths()],
  test: {
    server: { deps: { inline: ['@ionic/core', '@ionic/angular'] } },
    globals: true,
    environment: 'jsdom',
    setupFiles: ['../../tools/test-setup.ts'],
    include: ['src/**/*.spec.ts'],
  },
});
