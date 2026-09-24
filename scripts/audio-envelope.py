"""Measure the recording's actual amplitude for decorative, source-derived waveforms."""
import av
import numpy as np
import json
from pathlib import Path
root=Path(__file__).resolve().parents[1]
bins=np.zeros(7446,dtype=np.float32)
with av.open(str(root/'site/media/electrical.m4a')) as container:
    for frame in container.decode(audio=0):
        if frame.time is None: continue
        index=max(0,min(len(bins)-1,int(frame.time)))
        bins[index]=max(bins[index],float(np.max(np.abs(frame.to_ndarray()))))
scale=float(np.percentile(bins,95)) or 1
values=np.minimum(bins/scale,1)
(root/'site/data/waveform.json').write_text(json.dumps([round(float(v),3) for v in values],separators=(',',':')),encoding='utf-8')
print(f'Measured {len(values)} one-second amplitude bins')
