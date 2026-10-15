import { defineConfig } from 'vite';

export default defineConfig({
  root: './',
  base: './',
  server: {
    port: 5190,
    host: true
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  }
});
