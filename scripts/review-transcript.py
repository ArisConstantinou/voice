"""Group the complete source into manageable chronological editorial review files."""
import json
from pathlib import Path
root=Path(__file__).resolve().parents[1]
source=root/'work/segments.jsonl'
rows=[json.loads(line) for line in source.read_text(encoding='utf-8').splitlines() if line.strip()]
out=root/'work/review'
out.mkdir(exist_ok=True)
chapters={}
for row in rows:
    chapter=int(row['start']//600)
    block=int(row['start']//30)*30
    chapters.setdefault(chapter,{}).setdefault(block,[]).append(row['text'])
for chapter,blocks in chapters.items():
    text='\n'.join(f'[{t//3600:02}:{t//60%60:02}:{t%60:02}] '+ ' '.join(parts) for t,parts in blocks.items())
    (out/f'{chapter:02d}.txt').write_text(text,encoding='utf-8')
print(f'{len(rows)} segments in {len(chapters)} chronological review files')
