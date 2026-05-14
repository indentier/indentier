import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts', 'src/cli.ts'],
  format: ['esm', 'cjs'],
  target: 'node22',
  platform: 'node',
  dts: true,
  clean: true,
  sourcemap: false,
  shims: true,
  outDir: 'dist',
});
