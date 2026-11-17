// The history videos: art/videos/<fossil-id>.mp4, rendered from the cutscene scripts by tools/render-cutscene.py.
// A fossil without a file simply plays the in-engine canvas cutscene. Build with DM_NO_VIDEOS=1 to leave every mp4 out of the app
// (vite.config.js swaps the glob for an empty map), which keeps the APK small.
const files = import.meta.glob('../../../../art/videos/*.mp4', { eager: true, query: '?url', import: 'default' });
const byId = new Map(Object.entries(files).map(([p, u]) => [p.replace(/^.*\/([^/]+)\.mp4$/, '$1'), u]));
export const videoUrlFor = (fossilId) => byId.get(fossilId) || null;
export const videoCount = () => byId.size;
