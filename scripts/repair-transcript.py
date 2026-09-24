"""Second, non-batched pass for detected ASR loops. Retains an audit trail locally."""
import os,sys,json,collections
from pathlib import Path
root=Path(__file__).resolve().parents[1]
handles=[]
for p in (Path(sys.prefix)/'Lib/site-packages/nvidia').glob('*/bin'):
    os.environ['PATH']=str(p)+os.pathsep+os.environ['PATH']
    handles.append(os.add_dll_directory(str(p)))
from faster_whisper import WhisperModel
from faster_whisper.audio import decode_audio
raw=json.loads((root/'work/transcript.json').read_text(encoding='utf-8'))
def suspect(text):
    words=text.lower().split()
    repeats=max(collections.Counter(zip(words,words[1:],words[2:])).values(),default=0)
    return 'authorwave' in text.lower() or repeats>=4
targets=[s for s in raw['segments'] if suspect(s['text'])]
print(f'Second pass: {len(targets)} flagged segments',flush=True)
audio=decode_audio(sys.argv[1],sampling_rate=16000)
model=WhisperModel(str(root/'.cache/local-model'),device='cuda',compute_type='float16',cpu_threads=4)
audit=[]
for n,s in enumerate(targets,1):
    clip=audio[int(s['start']*16000):int(s['end']*16000)]
    candidates,_=model.transcribe(clip,language='el',beam_size=5,word_timestamps=True,
        vad_filter=True,condition_on_previous_text=False,compression_ratio_threshold=2.0,
        hallucination_silence_threshold=1.0,temperature=(0.0,0.2,0.4))
    candidates=list(candidates)
    text=' '.join(c.text.strip() for c in candidates).strip()
    before=s['text']
    if not text or suspect(text):
        s['text']='[Δεν προέκυψε αξιόπιστη μεταγραφή για αυτό το απόσπασμα — ακούστε την πηγή.]'
        s['words']=[]
        s['avg_logprob']=-2
    else:
        s['text']=text
        s['avg_logprob']=sum(c.avg_logprob for c in candidates)/len(candidates)
        s['words']=[{'start':round(w.start+s['start'],2),'end':round(w.end+s['start'],2),
                     'word':w.word,'probability':round(w.probability,3)} for c in candidates for w in (c.words or [])]
    s['secondPass']=True
    audit.append({'id':s['id'],'start':s['start'],'end':s['end'],'before':before,'after':s['text']})
    (root/'work/repair-audit.json').write_text(json.dumps(audit,ensure_ascii=False,indent=2),encoding='utf-8')
    print(f'Repaired {n}/{len(targets)}; timestamp {s["start"]:.0f}s',flush=True)
(root/'work/transcript-refined.json').write_text(json.dumps(raw,ensure_ascii=False,indent=2),encoding='utf-8')
print('Second pass complete; still an automatic transcript, not a certified verbatim record.',flush=True)
