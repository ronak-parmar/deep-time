import { defineConfig } from 'vite';

// base './' so the build runs from a file path or inside a Capacitor WebView.
// fs.allow reaches the repo root because the design system and sprites live outside this folder.
//
// Production builds ship only runtime art: the whole art-standins glob of render/art.js (backgrounds, ui, and the temporary jurassic
// leaf / lava-glow props) is dropped (the real art/ files replace them; art/props does not exist), so dist/ holds the .webp
// backgrounds, the UI kit, the gem sprites, fx and ambient art. Dev keeps the stand-ins (props only with ?standins).
// Set DM_NO_VIDEOS=1 to leave the history videos (art/videos/*.mp4) out of the build (smaller APK).
const runtimeArtOnly = () => ({
  name: 'runtime-art-only',
  apply: 'build',
  enforce: 'pre',
  transform(code, id) {
    const f = id.replace(/\\/g, '/');
    if (f.endsWith('/src/render/art.js')) return code.replace(/import\.meta\.glob\('\.\.\/\.\.\/art-standins\/[^)]*\)/, '{}');
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
