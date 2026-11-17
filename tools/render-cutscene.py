#!/usr/bin/env python3
"""Render the history cutscenes to real mp4 files (art/videos/<fossil-id>.mp4) with headless Chromium + ffmpeg.

  Start the dev server first (cd games/dino-match && npx vite --port 5199), then:
    python3 tools/render-cutscene.py cretaceous-triceratops          one fossil
    python3 tools/render-cutscene.py --all                           all 47
    python3 tools/render-cutscene.py cretaceous-triceratops --check  only write 4 full-size PNG frames to look at

  720x1280, 30 fps, H.264 (libx264 CRF 23, veryfast, yuv420p, faststart) + AAC. The picture is a pure function of time
  (page.__frame(t)); the music bed is rendered offline in the page (page.__bed(id)). Each file is written to a temporary
  .mp4 name and renamed only when ffmpeg exits 0. Needs: playwright (python) with Chromium, ffmpeg.
"""
import argparse, base64, json, os, subprocess, sys, tempfile, time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'art' / 'videos'
FPS = 30

def render(page, base, fid, args):
    page.goto(f'{base}/render-cutscene.html'); page.wait_for_function('window.__ready === true', timeout=60000)
    info = page.evaluate('id => window.__setup(id)', fid)
    dur = info['duration']; n = round(dur * FPS)
    if args.check:
        outdir = Path(args.check_dir); outdir.mkdir(parents=True, exist_ok=True)
        for t in [dur * k for k in (0.12, 0.3, 0.5, 0.75)]:
            page.evaluate('t => window.__frame(t)', t)
            page.locator('#c').screenshot(path=str(outdir / f'{fid}-{t:05.1f}s.png'))
        print(f'{fid}: wrote 4 check frames to {outdir}'); return None
    OUT.mkdir(parents=True, exist_ok=True)
    final = OUT / f'{fid}.mp4'; tmp = OUT / f'.{fid}.partial.mp4'
    wav = tempfile.NamedTemporaryFile(suffix='.wav', delete=False); wav.write(base64.b64decode(page.evaluate('id => window.__bed(id)', fid))); wav.close()
    cmd = ['ffmpeg', '-y', '-v', 'error', '-f', 'image2pipe', '-framerate', str(FPS), '-c:v', 'mjpeg', '-i', '-', '-i', wav.name,
           '-c:v', 'libx264', '-preset', args.preset, '-crf', str(args.crf), '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
           '-c:a', 'aac', '-b:a', '128k', '-t', f'{dur:.3f}', str(tmp)]
    t0 = time.time(); ff = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    try:
        for i in range(n):
            page.evaluate('t => window.__frame(t)', i / FPS)
            ff.stdin.write(page.locator('#c').screenshot(type='jpeg', quality=92))
        ff.stdin.close(); code = ff.wait()
    except Exception:
        ff.kill(); tmp.unlink(missing_ok=True); raise
    finally:
        os.unlink(wav.name)
    if code != 0: tmp.unlink(missing_ok=True); raise SystemExit(f'ffmpeg failed for {fid}')
    os.replace(tmp, final)
    print(f'{fid}: {dur:.1f}s, {final.stat().st_size/1e6:.2f} MB, rendered in {time.time()-t0:.0f}s')
    return {'id': fid, 'duration': round(dur, 2), 'bytes': final.stat().st_size}

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('ids', nargs='*'); ap.add_argument('--all', action='store_true')
    ap.add_argument('--base', default='http://127.0.0.1:5199'); ap.add_argument('--crf', type=int, default=23); ap.add_argument('--preset', default='veryfast')
    ap.add_argument('--check', action='store_true'); ap.add_argument('--check-dir', default=str(ROOT / 'docs' / 'screens' / 'm2' / 'check'))
    ap.add_argument('--chrome', default=os.environ.get('CHROME_PATH'))
    args = ap.parse_args()
    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=args.chrome, args=['--no-sandbox', '--autoplay-policy=no-user-gesture-required']) if args.chrome else p.chromium.launch(args=['--no-sandbox'])
        page = b.new_page(viewport={'width': 720, 'height': 1280}, device_scale_factor=1)
        page.goto(f'{args.base}/render-cutscene.html'); page.wait_for_function('window.__ready === true', timeout=60000)
        ids = args.ids
        if args.all:
            ids = page.evaluate("async () => (await import('/src/data/roster.js')).ROSTER.map(f => f.id)")
        if not ids: ap.error('give fossil ids or --all')
        man = OUT / 'manifest.json'; entries = {e['id']: e for e in (json.loads(man.read_text()) if man.exists() else [])}
        for fid in ids:
            e = render(page, args.base, fid, args)
            if e: entries[fid] = e
        if not args.check:
            order = page.evaluate("async () => (await import('/src/data/roster.js')).ROSTER.map(f => f.id)")
            man.write_text(json.dumps([entries[i] for i in order if i in entries], indent=1) + '\n')
        b.close()

if __name__ == '__main__': main()
