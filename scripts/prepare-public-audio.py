"""Create a redacted derivative without changing the user's source recording."""
import json
import subprocess
import sys
from pathlib import Path
root = Path(__file__).resolve().parents[1]
source = Path(sys.argv[1]).resolve()
target = root / 'site/media/electrical.m4a'
assert source != target.resolve(), 'Source and public derivative must be different files'
redactions = json.loads((root / 'content/redactions.json').read_text(encoding='utf-8'))
filters = ','.join(f"volume=0:enable='between(t,{r['start']},{r['end']})'" for r in redactions)
temporary = root / 'work/electrical-public.m4a'
temporary.parent.mkdir(exist_ok=True)
subprocess.run(['ffmpeg', '-hide_banner', '-i', str(source), '-map_metadata', '-1', '-af', filters,
                '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart', '-y', str(temporary)], check=True)
target.parent.mkdir(exist_ok=True)
temporary.replace(target)
