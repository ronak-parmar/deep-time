import { defineConfig } from 'vite';

// base './' so the build runs from a file path or inside a Capacitor WebView.
// fs.allow reaches the repo root because the design system and sprites live outside this folder.
export default defineConfig({
  base: './',
  server: { fs: { allow: ['../..'] } },
  build: { target: 'es2020', assetsInlineLimit: 0 },
  test: { environment: 'node', include: ['tests/**/*.test.js'] }
});
