#!/usr/bin/env python3
"""Smaller copies of the history videos for the APK: 540x960, CRF 28 (veryfast, faststart, AAC 96k).

  python3 tools/compress-videos.py            art/videos/*.mp4 -> art/videos-small/*.mp4 (+ manifest.json)
  python3 tools/compress-videos.py --inplace  replace the files in art/videos (after the originals are kept elsewhere)

Each output is written to a temporary .mp4 name and renamed when ffmpeg exits 0.
"""
import argparse, json, os, subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'art' / 'videos'

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--inplace', action='store_true'); ap.add_argument('--crf', type=int, default=28)
    a = ap.parse_args(); dst = SRC if a.inplace else ROOT / 'art' / 'videos-small'; dst.mkdir(parents=True, exist_ok=True)
    out, before, after = [], 0, 0
    for f in sorted(SRC.glob('*.mp4')):
        if f.name.startswith('.'): continue
        tmp = dst / f'.{f.stem}.partial.mp4'; fin = dst / f.name
        r = subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', str(f), '-vf', 'scale=540:960', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', str(a.crf),
                            '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-c:a', 'aac', '-b:a', '96k', str(tmp)])
        if r.returncode != 0: tmp.unlink(missing_ok=True); raise SystemExit(f'ffmpeg failed for {f.name}')
        b0 = f.stat().st_size; os.replace(tmp, fin); b1 = fin.stat().st_size; before += b0; after += b1
        dur = float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', str(fin)]))
        out.append({'id': f.stem, 'duration': round(dur, 2), 'bytes': b1}); print(f'{f.name}: {b0/1e6:.2f} MB -> {b1/1e6:.2f} MB')
    (dst / 'manifest.json').write_text(json.dumps(out, indent=1) + '\n')
    print(f'total {before/1e6:.1f} MB -> {after/1e6:.1f} MB')

if __name__ == '__main__': main()
