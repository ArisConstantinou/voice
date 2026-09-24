"""Build source-linked editorial data; do not infer missing speech or identities."""
import json
from pathlib import Path
root = Path(__file__).resolve().parents[1]
archive = json.loads((root / 'content/editorial.json').read_text(encoding='utf-8'))
raw = json.loads((root / 'work/transcript-refined.json').read_text(encoding='utf-8'))
redactions = json.loads((root / 'content/redactions.json').read_text(encoding='utf-8'))
for memory in archive['memories']:
    start, end = memory['start'], memory['end']
    assert not any(start < r['end'] and end > r['start'] for r in redactions)
    words = [w for s in raw['segments'] for w in s['words'] if w['start'] >= start and w['end'] <= end]
    memory['transcript'] = ''.join(w['word'] for w in words).strip()
    assert memory['transcript'], memory['id']
(root / 'site/data/archive.json').write_text(json.dumps(archive, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
print(json.dumps({key: len(archive[key]) for key in ['topics', 'memories', 'lessons']}))
