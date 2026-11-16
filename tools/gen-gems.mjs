// Deep Time gem generator (Gemini image model).
// No npm install needed (uses built-in fetch). Usage from repo root:
//   cmd:         set GEMINI_API_KEY=your key
//   PowerShell:  $env:GEMINI_API_KEY="your key"
//   node tools/gen-gems.mjs base            # 6 blank base gems
//   node tools/gen-gems.mjs full            # 60 era gems (6 x 10)
//   node tools/gen-gems.mjs full --era cretaceous --gem red   # filter
// Existing files are skipped, so it is safe to re-run.
import fs from 'node:fs';
import path from 'node:path';

const key = process.env.GEMINI_API_KEY;
if (!key) { console.error('Set GEMINI_API_KEY first.'); process.exit(1); }
const MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image';

const REF = path.resolve('art/reference/gem-style.png');
const OUT = path.resolve('art/gems');

const GEMS = {
  red:    'red octagon gem',
  green:  'green oval gem',
  blue:   'blue diamond (rhombus) gem',
  yellow: 'yellow downward-pointing triangle gem',
  purple: 'purple pentagon gem with small crystal spikes on top',
  amber:  'orange amber teardrop gem',
};

const ERAS = {
  cambrian:      { red: 'Anomalocaris', green: 'kelp frond', blue: 'trilobite', yellow: 'Opabinia', purple: 'Hallucigenia', amber: 'Marrella' },
  devonian:      { red: 'Dunkleosteus armoured fish', green: 'tree lycopod', blue: 'Tiktaalik', yellow: 'sea scorpion', purple: 'ammonite', amber: 'early insect' },
  carboniferous: { red: 'Arthropleura', green: 'giant fern', blue: 'Eryops amphibian', yellow: 'Meganeura giant dragonfly', purple: 'Hylonomus early reptile', amber: 'cockroach' },
  permian:       { red: 'Gorgonopsid', green: 'Cotylorhynchus', blue: 'Dimetrodon sail', yellow: 'Meganeuropsis dragonfly', purple: 'Edaphosaurus', amber: 'beetle' },
  triassic:      { red: 'Coelophysis', green: 'Plateosaurus', blue: 'cynodont', yellow: 'Eudimorphodon', purple: 'aetosaur', amber: 'early fly' },
  jurassic:      { red: 'Allosaurus skull', green: 'Brachiosaurus', blue: 'ichthyosaur', yellow: 'Pterodactylus', purple: 'Stegosaurus', amber: 'dragonfly' },
  cretaceous:    { red: 'T. rex skull', green: 'titanosaur', blue: 'Triceratops', yellow: 'Pteranodon', purple: 'Ankylosaurus', amber: 'mosquito' },
  mammals:       { red: 'Hyaenodon', green: 'Paraceratherium', blue: 'Uintatherium', yellow: 'giant bat', purple: 'Glyptodont', amber: 'ant' },
  iceage:        { red: 'Smilodon skull', green: 'giant ground sloth', blue: 'woolly mammoth', yellow: 'Teratorn bird', purple: 'woolly rhino', amber: 'frost-covered beetle' },
  humans:        { red: 'cave lion', green: 'aurochs', blue: 'cave-art handprint', yellow: 'torch flame', purple: 'stone hand axe', amber: 'bone needle' },
};

const STYLE = 'Use the attached image as the exact style reference: glossy faceted gemstone, thick dark outline, soft inner glow, light from top left, small sparkle highlights. ' +
  'Single gem only, centred, fills about 80% of the frame, 1024x1024, flat solid dark navy background (#0f1424), no text, no watermark, no extra objects.';

const args = process.argv.slice(2);
const mode = args[0] || 'full';
const opt = (n) => { const i = args.indexOf('--' + n); return i > -1 ? args[i + 1] : null; };
const onlyEra = opt('era'), onlyGem = opt('gem');

const refB64 = fs.readFileSync(REF).toString('base64');

async function gen(prompt, file) {
  if (fs.existsSync(file)) { console.log('skip', file); return; }
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
  const body = JSON.stringify({
    contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: 'image/png', data: refB64 } }] }],
    generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
  });
  for (let attempt = 1; attempt <= 4; attempt++) {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key }, body });
    if (r.status === 429 || r.status >= 500) { console.log(`retry ${attempt} (${r.status}) ${file}`); await new Promise((s) => setTimeout(s, 4000 * attempt)); continue; }
    const raw = await r.text();
    let j;
    try { j = JSON.parse(raw); } catch { console.error('Non-JSON response', r.status, r.url, '\n' + raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 400)); return; }
    if (!r.ok) { console.error('API error', r.status, JSON.stringify(j).slice(0, 400)); return; }
    const parts = j.candidates?.[0]?.content?.parts || [];
    const img = parts.map((p) => p.inlineData || p.inline_data).find(Boolean);
    if (!img) { console.error('no image for', file, parts.map((p) => p.text).filter(Boolean).join(' ').slice(0, 300)); return; }
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, Buffer.from(img.data, 'base64'));
    console.log('wrote', file);
    return;
  }
  console.error('gave up on', file);
}

if (mode === 'base') {
  for (const [g, shape] of Object.entries(GEMS)) {
    if (onlyGem && onlyGem !== g) continue;
    await gen(`Create a ${shape}, same style and shape as in the reference, but with a plain smooth recessed centre and NO emblem or creature carved in it. ${STYLE}`, path.join(OUT, '_base', `${g}.png`));
  }
} else {
  for (const [era, map] of Object.entries(ERAS)) {
    if (onlyEra && onlyEra !== era) continue;
    for (const [g, shape] of Object.entries(GEMS)) {
      if (onlyGem && onlyGem !== g) continue;
      await gen(`Create a ${shape} matching the reference gem of that colour exactly in shape, colour, facets and glow. Engrave one bold simple emblem in the centre: ${map[g]} (${era.replace('iceage', 'ice age')} era). Emblem is a clean readable silhouette, lower contrast than the gem outline, legible at 48 px. ${STYLE}`, path.join(OUT, era, `${g}.png`));
    }
  }
}
