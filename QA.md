# Verification record

The initial-release measurements below describe the 24 September version.
The inline-panel and orbital-motion update is recorded at the end of this file.

Verified locally on 24 September 2026, Windows, installed Chrome with Playwright.
This is a new project; no previous release existed for before/after comparison.

## Automated checks

`npm test` passes: 220 chronological public transcript entries (including the
redaction notice), 8 topics, 3 memories, 12 lessons, valid source-time ranges,
182,327 bytes of initial transcript plus editorial JSON, public audio hash,
no public speech overlapping the removed interval, and silent waveform bins.

`node scripts/browser-qa.cjs` passed **33 interaction checks**. It uses an existing
Playwright runtime, configurable with `VOICE_PLAYWRIGHT_PACKAGE`; it does not
require adding browser tooling to production dependencies. Use `VOICE_QA_URL`
to check another deployment and `VOICE_QA_OUTPUT` for a separate evidence folder.

Covered: content counts; deferred audio download; live source/code search;
empty-result recovery; Greek case/accent normalization; category filters;
source readers; Escape; authentic excerpt seeking and playback; excerpt stop;
playback speed; transcript chapters and following audio; detailed lessons;
source links; Greek synthesis invocation and cancellation; motion controls;
private-interval skip; direct story links; unsupported microphone fallback;
simulated permission denial and recognized voice input; uncaught errors.

No uncaught page errors. All eight recorded test-browser processes exited after
the run. Existing user browsers and other development servers were not stopped.

## Responsive and visual checks

Actual page captures inspected at 1440x1000, 820x1180, 390x844 and 360x800.
No horizontal document overflow. The final mobile layout uses a single readable
card column; the tablet layout stacks the hero, search and galaxy to avoid
collisions. The modal reader fits the narrow viewport. Source stories and
learning sections were also captured and inspected. Evidence is saved locally
under `output/playwright/`, excluded from the published artifact.

## Performance observations

Representative local interaction run, Chrome headless, desktop viewport:

- Initial navigation: **217 ms**.
- Initial transferred resources: **367,953 bytes**, no audio requested.
- Fill-to-live-result check: **222 ms**, including the 100 ms input debounce.
- JS heap after initial rendering: approximately **3.9 MB**.
- 120 requestAnimationFrame intervals with the galaxy visible: mean **4.17 ms**,
  p95 **4.30 ms**, maximum **4.50 ms** on this host's high-refresh environment.

These are single local observations, not mobile hardware benchmarks or promises
for internet loading. CSS-only refinements were then checked at all four widths.
The site has no framework runtime, external font request, background audio
prefetch or real-time AI requests. Audio is 89,138,354 bytes and supports range
requests. No physical iPhone/Safari performance measurement was made.

## Privacy and source integrity

The owner explicitly selected omission of the private telephone aside.
The public derivative mutes **3410–3667 seconds** while retaining source timing.
FFmpeg measured the interior of this interval at the signed-16-bit silence floor
(mean and peak -91 dB); decoded waveform interior bins are all zero.
The player skips the range even after a manual seek. Public transcript and VTT
contain only an omission notice for that interval. Raw materials stay ignored.

Public audio SHA-256:
`5E9940076F3223DD3F6E85F8898C5E27FDC84BF33586995D90A0FA56A3EA0F91`.
The original source hash was checked again and remained unchanged.

## Explicit limits

- Transcription is automatic, not a human-certified verbatim record.
- 33 public entries are flagged uncertain. Nine small intervals could not be
  reliably transcribed after the targeted second pass; their audio is available.
- Microphone results and failures were simulated. End-to-end spoken recognition
  on the user's device and vendor service was not verified.
- Speech synthesis was tested for invocation and cancellation, not pronunciation;
  this test Chrome environment did not offer an installed Greek voice.
- Emulated mobile viewports do not establish physical iPhone/Safari support.
- The source drawing and verified speaker identities were not provided.

GitHub Actions and public deployment verification are recorded after publishing.

## Public deployment verification

The first published artifact, commit `2e45d20`, passed all 33 browser checks on
**https://arisconstantinou.github.io/voice/**, not just localhost. GitHub Actions
run [36051903722](https://github.com/ArisConstantinou/voice/actions/runs/36051903722)
succeeded. Seven served text/data hashes matched the committed files; the public
audio length and three separate 64 KiB HTTP206 ranges matched the redacted file.

Public navigation observation: 1,091 ms, 172,248 transferred resource bytes with
HTTP compression, 143 ms live-search interaction. No uncaught browser errors;
all owned browser processes exited. Public evidence is in
`output/playwright/public/` and `work/public-deployment.json` locally. A final
mobile-only planet-label spacing adjustment followed this full run; its rendered
layout and served artifact are checked separately before task completion.

## Inline panels and orbital navigation — 25 September 2026

The user reported that the modal backdrop obscured the audio timeline. The old
version was reproduced from commit `361a319` and captured before editing.
The replacement reader mounts after the relevant grid row or search result,
uses natural page height, and has visible close controls. Opening it pushes
following content down. The native audio timeline stays hit-testable while a
source excerpt plays, and playback continues if the panel is closed.

The search, microphone and three section shortcuts occupy one row on desktop
and 360 px mobile. That row docks at the top after scrolling past its home
position. Typing while docked reveals live results. Its Galaxy, Memories and
Learning shortcuts were each navigated. Planet buttons orbit around the sun;
the labelled control freezes and resumes them. The system reduced-motion
setting also keeps planets still.

`node scripts/browser-qa.cjs` passed **55 local interaction checks** in Chrome,
including the exact open → play → use timeline → close chain, source privacy
regression, mobile/tablet overflow, and absence of page errors. All owned
test-browser processes exited. The inspected comparison captures are stored at
`output/playwright/interaction-comparison/` locally.

A 2.2 s comparison on the same browser and desktop viewport measured
`TaskDuration` of 250.32 ms before and 249.08 ms after the transform-based
orbit implementation; the previously fixed planet moved 16.38 screen px.
These are individual desktop measurements, not phone performance evidence or
a claim of zero rendering cost. The final local run showed a 16.8 ms p95
animation-frame interval on this 60 Hz headless browser. Physical-device and
real-microphone limitations above still apply.

## iPhone scrolling repair — 25 September 2026

The user's physical-phone screenshot showed the search bar absent during scroll
and the audio dock painted above the bottom edge. The older local WebKit
emulation did not reproduce that compositor failure, so this is not recorded
as a confirmed local reproduction. The search element now moves to the body
once on load instead of being reparented during scrolling; fixed bars use
opaque backgrounds without backdrop blur. Both bars are aligned to the visible
viewport on viewport changes. This addresses the site's fragile scroll path
and the Safari viewport-offset case, but physical iPhone confirmation remains
necessary.

`node scripts/mobile-viewport-qa.cjs` passed 32 focused checks across WebKit
and Chromium iPhone-sized contexts: four scroll positions in each, top and
bottom anchoring, hit testing of the search and native timeline, simulated
visual-viewport changes, return to the hero, and no page errors. The existing
55 interaction checks and `npm test` also passed locally. Captures and the
focused report are in `output/playwright/mobile-viewport/` locally.
On the same emulated mobile Chrome viewport, one controlled 35-step scroll
measured 37.76 ms TaskDuration before and 33.10 ms after; the corresponding
script times were 2.62 and 2.46 ms. This is a single comparison, not physical
phone performance evidence.
