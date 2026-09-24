"""Bounded, resumable HTTP range download when the hub transport stalls."""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
import urllib.request
import hashlib
import time
import shutil

root = Path(__file__).resolve().parents[1]
out = root / '.cache/local-model'
parts = root / '.cache/model-parts'
out.mkdir(parents=True, exist_ok=True)
parts.mkdir(parents=True, exist_ok=True)
url = 'https://huggingface.co/Systran/faster-whisper-large-v3/resolve/main/model.bin'
total = 3087284237
chunk = 32 * 1024 * 1024
expected_hash = '69f74147e3334731bc3a76048724833325d2ec74642fb52620eda87352e3d4f1'
snapshot = next((root / '.cache/models/models--Systran--faster-whisper-large-v3/snapshots').iterdir())
for file in snapshot.iterdir():
    if file.name != 'model.bin': shutil.copy2(file, out / file.name)

def download(index):
    start = index * chunk
    end = min(start + chunk, total) - 1
    target = parts / f'{index:03d}.part'
    if target.exists() and target.stat().st_size == end-start+1:
        return target.stat().st_size
    for attempt in range(2):
        try:
            request = urllib.request.Request(url, headers={'Range': f'bytes={start}-{end}'})
            with urllib.request.urlopen(request, timeout=35) as response:
                if response.status != 206 or response.headers.get('Content-Range') != f'bytes {start}-{end}/{total}':
                    raise RuntimeError('Server did not honor the requested byte range')
                with target.open('wb') as file:
                    while data := response.read(1024*1024): file.write(data)
            if target.stat().st_size != end-start+1: raise RuntimeError('Incomplete range')
            return target.stat().st_size
        except Exception:
            if attempt == 1: raise
            time.sleep(2)

started = time.time()
done = 0
with ThreadPoolExecutor(max_workers=4) as pool:
    futures = [pool.submit(download,i) for i in range((total+chunk-1)//chunk)]
    for n,future in enumerate(as_completed(futures),1):
        done += future.result()
        if n % 4 == 0: print(f'{done/total:.0%}: {done/1e6:.0f} MB in {time.time()-started:.0f}s',flush=True)

digest = hashlib.sha256()
temp = out / 'model.bin.tmp'
with temp.open('wb') as file:
    for part in sorted(parts.glob('*.part')):
        with part.open('rb') as source:
            while data := source.read(8*1024*1024):
                file.write(data)
                digest.update(data)
if digest.hexdigest() != expected_hash: raise RuntimeError('Model SHA-256 mismatch')
temp.replace(out / 'model.bin')
print(f'VERIFIED model SHA-256 {digest.hexdigest()}',flush=True)
