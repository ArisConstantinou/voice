"""Package the automatic transcript, excluding every owner-redacted interval."""
import hashlib
import json
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
raw = json.loads((ROOT / 'work/transcript-refined.json').read_text(encoding='utf-8'))
redactions = json.loads((ROOT / 'content/redactions.json').read_text(encoding='utf-8'))
out = ROOT / 'site/data'
out.mkdir(exist_ok=True)
segments = []
for source in raw['segments']:
    pieces = [(source['start'], source['end'])]
    for gap in redactions:
        pieces = [(a, b) for start, end in pieces for a, b in
                  [(start, min(end, gap['start'])), (max(start, gap['end']), end)] if b > a]
    for start, end in pieces:
        clipped = start != source['start'] or end != source['end']
        words = [w for w in source['words'] if w['start'] >= start and w['end'] <= end]
        text = ''.join(w['word'] for w in words).strip() if clipped else source['text'].strip()
        if not text:
            continue
        segments.append({'start': start, 'end': end, 'text': text,
                         'uncertain': source['avg_logprob'] < -.7 or
                         (bool(words) and sum(w['probability'] for w in words) / len(words) < .65)})
for gap in redactions:
    segments.append({'start': gap['start'], 'end': gap['end'], 'text': gap['label'],
                     'uncertain': False, 'redacted': True})
segments.sort(key=lambda s: s['start'])
for index, segment in enumerate(segments):
    segment['id'] = index

data = {k: raw[k] for k in ['source', 'duration', 'language', 'model']}
data.update(status='automatic-with-targeted-second-pass', redactions=redactions,
            publicAudioSha256=hashlib.sha256((ROOT / 'site/media/electrical.m4a').read_bytes()).hexdigest().upper(),
            segments=segments)
(out / 'transcript.json').write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')

def timestamp(t):
    ms = round(t * 1000)
    return f'{ms//3600000:02}:{ms//60000%60:02}:{ms//1000%60:02}.{ms%1000:03}'

vtt = 'WEBVTT\n\nNOTE Automatic Greek transcription. Private aside omitted from public audio and text.\n\n'
for s in segments:
    vtt += f"{s['id']}\n{timestamp(s['start'])} --> {timestamp(s['end'])}\n{s['text']}\n\n"
(out / 'transcript.vtt').write_text(vtt.rstrip()+'\n', encoding='utf-8')
print(json.dumps({'segments': len(segments), 'uncertain': sum(s['uncertain'] for s in segments),
                  'first': segments[0]['start'], 'last': segments[-1]['end']}, ensure_ascii=False))
