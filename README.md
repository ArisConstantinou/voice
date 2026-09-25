# VOICE

A living galaxy of an electrical conversation: thematic planets, memory stars,
searchable Greek speech, real audio excerpts, and detailed learning notes.

Public address: **https://arisconstantinou.github.io/voice/**.

## Run locally

Requires Node.js 22 or newer. No JavaScript package dependencies.

```powershell
npm run dev
npm test
```

Open **http://127.0.0.1:5173/voice/**. Port **5173** is fixed for this project;
the server exits if occupied and never selects another port. Byte-range requests
allow seeking without downloading the entire recording.

Validation checks transcript chronology, source references, public-audio SHA-256,
redacted intervals, waveform silence, content IDs, and initial text payload.
See [QA.md](QA.md) for browser evidence and limitations.

## Content and provenance

The source is the owner-supplied `Electrical.m4a`, approximately 2:04:05.
The original stays outside the repository and is never modified.

- **8 topics**, **12 detailed lessons**, **3 personal recollections**.
- `content/editorial.json`: editable summaries, learning notes and source times.
- `content/redactions.json`: owner-approved private intervals.
- `site/data/archive.json`: packaged editorial content and ASR memory excerpts.
- `site/data/transcript.json`: automatic time-indexed public transcript.
- `site/data/transcript.vtt`: downloadable public WebVTT.
- `site/data/waveform.json`: measured amplitude of the public recording.
- `site/media/electrical.m4a`: AAC derivative with the private aside muted.

The owner requested omission of the private telephone aside **56:50–1:01:07**.
It is absent from public speech text and silent in the public audio; the player
also skips it automatically. Original timestamps remain stable. The derivative
was re-encoded at 96 kb/s; it is not a byte-identical copy or a cloned voice.
The unredacted source, raw transcript and processing cache are excluded from git.

Automatic recognition can mishear Cypriot Greek, names, abbreviations and numbers.
A targeted second pass handled 21 suspicious segments. Nine short intervals still
lack a reliable transcription and say so explicitly, with audio available.
33 public entries carry a confidence warning. This is not a certified transcript
or a claim of human verification of every spoken word. Speaker identities are
not inferred. Editorial explanations and ASR quotations are presented separately.

Electrical statements in the conversation are source material, not installation
instructions. Learning notes distinguish recollection, interpretation, uncertain
numbers and verified reference material. Relevant external explanations link
primary IET, ETEK and EAC sources. The original electrical drawing was not supplied;
its quantities and visually indicated positions cannot be independently checked.

## Search, audio and accessibility

The shared index covers every public transcript segment, topic, memory and lesson.
Live search supports partial words, case/accent normalization and selected
Greek/English aliases. Results open the source context and related detailed notes.
It is a deterministic, curated reader, not a live generative AI service. Search
cannot recover words that automatic recognition missed; the source audio remains
available. Codes and ambiguous units are not silently invented or normalized.

The recording loads on demand. Desktop uses native audio controls. Mobile has a
wide timeline with centered playback and 10-second skips, plus mute and speed.
Story excerpts play through the same controls. Synthetic reading is
explicitly labelled and uses device voices, without imitating the speaker.
A Greek voice must be available on the device for appropriate pronunciation.

Voice search uses `SpeechRecognition` / `webkitSpeechRecognition`, requires
microphone permission and HTTPS (or localhost), and may use the browser vendor's
online recognition service. No project backend receives audio. Unsupported
browsers retain text search and keyboard dictation. See
[MDN SpeechRecognition](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition).

The interface has keyboard navigation and labelled controls. Analysis opens in
natural-height panels between cards and results, leaving the audio timeline
available. The search row docks at the top while scrolling and keeps voice
search and the Galaxy, Memories and Learning shortcuts together. The clearly
labelled orbit control pauses or resumes moving planets and decorative motion;
system reduced-motion settings are respected. Only the manual motion preference
is saved in local storage. No analytics, accounts, API keys, paid AI endpoints
or database.

## Reproduce content processing

The approved local setup uses a project-local Python environment, faster-whisper
large-v3 and CUDA libraries. Versions are pinned in `requirements-transcription.txt`.
Model weights and temporary files remain in ignored `.cache/` and `work/`.
No system CUDA installation is changed.

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-transcription.txt
.\.venv\Scripts\python.exe scripts/transcribe.py 'PATH_TO_ORIGINAL.m4a'
.\.venv\Scripts\python.exe scripts/repair-transcript.py 'PATH_TO_ORIGINAL.m4a'
.\.venv\Scripts\python.exe scripts/prepare-public-audio.py 'PATH_TO_ORIGINAL.m4a'
.\.venv\Scripts\python.exe scripts/package-transcript.py
.\.venv\Scripts\python.exe scripts/build-archive.py
.\.venv\Scripts\python.exe scripts/audio-envelope.py
npm test
```

FFmpeg must be on PATH for the redacted derivative. Processing uses the local GPU;
first transcription downloads model weights if not already present. No paid
transcription API is called. Re-check all redactions, time ranges, editorial
content and publication rights before replacing the source with another recording.

## Publish

`Publish Voice` validates and deploys **only `site/`** to GitHub Pages when `main`
is pushed. Pages uses the GitHub Actions build source. Tools, models and working
files never enter the hosted artifact. All resource paths are relative for
`/voice/`. Direct links use `?kind=memory&id=...` or `?q=...`, with no server routing.

## Credits and rights

GFS Didot and Inter are served locally with their SIL Open Font License texts in
`site/fonts/`. Planet and star artwork is CSS; the orbital positions use a
small client-side animation without external artwork.
Public hosting does not grant a reuse license for the recording or speakers'
voices. No cloned voice or invented testimony is used.

Transcription engine: [faster-whisper](https://github.com/SYSTRAN/faster-whisper).
