import { defineConfig } from 'vite';

// base './' so the build runs from a file path or inside a Capacitor WebView.
// fs.allow reaches the repo root because the design system and sprites live outside this folder.
//
// Production builds ship only runtime art: the temporary art-standins/backgrounds and art-standins/ui images are
// dropped (the real art/ files replace them), so dist/ holds the .webp backgrounds, the UI kit and the gem sprites.
// Set DM_NO_VIDEOS=1 to leave the history videos (art/videos/*.mp4) out of the build (smaller APK).
const runtimeArtOnly = () => ({
  name: 'runtime-art-only',
  apply: 'build',
  enforce: 'pre',
  transform(code, id) {
    const f = id.replace(/\\/g, '/');
    if (f.endsWith('/src/render/art.js')) return code.replace('{backgrounds,props,ui}', '{props}');
    if (f.endsWith('/src/render/videos.js') && process.env.DM_NO_VIDEOS) return code.replace(/import\.meta\.glob\([^)]*\)/, '{}');
    return null;
  }
});

export default defineConfig({
  base: './',
  plugins: [runtimeArtOnly()],
  server: { fs: { allow: ['../..'] } },
  build: { target: 'es2020', assetsInlineLimit: 0 },
  test: { environment: 'node', include: ['tests/**/*.test.js'] }
});
