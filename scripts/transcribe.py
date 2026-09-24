"""Local, checkpointed transcription. The source recording is never modified."""
import os
import sys
import json
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
handles = []
for directory in (Path(sys.prefix) / 'Lib/site-packages/nvidia').glob('*/bin'):
    os.environ['PATH'] = str(directory) + os.pathsep + os.environ['PATH']
    handles.append(os.add_dll_directory(str(directory)))
os.environ['HF_HUB_DISABLE_SYMLINKS_WARNING'] = '1'
os.environ['HF_HUB_DISABLE_PROGRESS_BARS'] = '1'
os.environ['HF_HUB_DISABLE_XET'] = '1'
from faster_whisper import WhisperModel, BatchedInferencePipeline

out = ROOT / 'work'
out.mkdir(exist_ok=True)
source = sys.argv[1]
started = time.time()
print('Loading large-v3; local CUDA inference.', flush=True)
local_model = ROOT / '.cache/local-model'
model_name = str(local_model) if (local_model / 'model.bin').exists() else 'large-v3'
model = WhisperModel(model_name, device='cuda', compute_type='float16',
                     download_root=str(ROOT / '.cache/models'), cpu_threads=4)
pipeline = BatchedInferencePipeline(model=model)
segments, info = pipeline.transcribe(source, language='el', beam_size=5,
    batch_size=4, word_timestamps=True, vad_filter=True,
    vad_parameters={'min_silence_duration_ms': 500})
print(json.dumps({'duration': info.duration, 'language': info.language}), flush=True)
rows = []
with (out / 'segments.jsonl').open('w', encoding='utf-8') as log:
    for s in segments:
        row = {'id': len(rows), 'start': round(s.start, 2), 'end': round(s.end, 2),
               'text': s.text.strip(), 'avg_logprob': s.avg_logprob,
               'no_speech_prob': s.no_speech_prob,
               'words': [{'start': round(w.start, 2), 'end': round(w.end, 2),
                          'word': w.word, 'probability': round(w.probability, 3)}
                         for w in (s.words or [])]}
        rows.append(row)
        log.write(json.dumps(row, ensure_ascii=False) + '\n')
        log.flush()
        if len(rows) % 50 == 0:
            print(f'{len(rows)} segments; {s.end / 60:.1f} minutes; elapsed {time.time()-started:.0f}s', flush=True)
result = {'source': Path(source).name, 'duration': info.duration, 'language': info.language,
          'model': 'faster-whisper/large-v3', 'status': 'automatic-unreviewed', 'segments': rows}
temporary = out / 'transcript.tmp.json'
temporary.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
temporary.replace(out / 'transcript.json')
print(f'COMPLETE: {len(rows)} segments in {time.time()-started:.0f}s', flush=True)
