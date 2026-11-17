// Headless frame renderer for tools/render-cutscene.mjs (and for looking at a cutscene by hand):
//   /render-cutscene.html?id=cretaceous-triceratops&t=14.2        one frame (t in seconds), 720 x 1280
// The driver calls window.__setup(id) once, then window.__frame(t) for every frame (deterministic: the picture is a pure
// function of t), and window.__bed(id) to render the music bed offline.
import { injectDesignSystem, loadFonts } from './ui/tokens.js';
import { FOSSILS, fossilById } from './core/fossils.js';
import { buildScript, partTimes } from './data/cutscene.js';
import { drawCutscene, loadCutsceneEnv, SIZE } from './render/cutscene.js';
import { preloadUi } from './render/art.js';
import { renderBed } from './render/sound.js';

injectDesignSystem();
await loadFonts();
await preloadUi();
const PX = 2, cv = document.getElementById('c');
cv.width = SIZE.w * PX; cv.height = SIZE.h * PX;
const ctx = cv.getContext('2d');
let fossil = null, env = null, script = null;
window.__setup = async (id) => {
  fossil = fossilById(id); if (!fossil) throw new Error('unknown fossil ' + id);
  env = await loadCutsceneEnv(fossil.era); script = buildScript(fossil);
  await document.fonts.ready;
  return { duration: script.duration, motion: script.motion, finale: script.finale, name: fossil.name };
};
window.__frame = (t) => { ctx.setTransform(PX, 0, 0, PX, 0, 0); drawCutscene(ctx, env, fossil, t, SIZE, script); return true; };
// music bed, rendered offline and returned as base64 16-bit PCM WAV (stereo, 44.1 kHz)
window.__bed = async (id) => {
  const f = fossilById(id), s = buildScript(f), sr = 44100;
  const oc = new OfflineAudioContext(2, Math.ceil(sr * s.duration), sr);
  renderBed(oc, oc.destination, 0, s, f);
  const buf = await oc.startRendering(), L = buf.getChannelData(0), R = buf.getChannelData(1), n = L.length, bytes = new Uint8Array(44 + n * 4), dv = new DataView(bytes.buffer);
  const w = (o, str) => [...str].forEach((ch, i) => dv.setUint8(o + i, ch.charCodeAt(0)));
  w(0, 'RIFF'); dv.setUint32(4, 36 + n * 4, true); w(8, 'WAVEfmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 2, true); dv.setUint32(24, sr, true); dv.setUint32(28, sr * 4, true); dv.setUint16(32, 4, true); dv.setUint16(34, 16, true); w(36, 'data'); dv.setUint32(40, n * 4, true);
  for (let i = 0; i < n; i++) { dv.setInt16(44 + i * 4, Math.max(-1, Math.min(1, L[i])) * 32767, true); dv.setInt16(46 + i * 4, Math.max(-1, Math.min(1, R[i])) * 32767, true); }
  let bin = ''; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
};
const q = new URLSearchParams(location.search);
if (q.get('id')) { await window.__setup(q.get('id')); window.__frame(+(q.get('t') || 0)); }
window.__ready = true;
void FOSSILS; void partTimes;
