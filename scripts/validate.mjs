import fs from 'node:fs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
const read = name => JSON.parse(fs.readFileSync(`site/data/${name}.json`, 'utf8'));
const transcript = read('transcript');
const archive = read('archive');
assert(transcript.segments.length > 100, 'Transcript must contain actual time-indexed speech');
assert(transcript.segments[0].start < 60, 'Beginning of audio is represented');
assert(transcript.segments.at(-1).end > transcript.duration - 90, 'End of audio is represented');
let previous = -1;
for (const s of transcript.segments) {
  assert(s.start >= previous, `Non-monotonic timestamp: ${s.id}`);
  assert(s.end >= s.start && s.end <= transcript.duration + 1, `Invalid segment: ${s.id}`);
  assert(s.text.trim().length > 0);
  previous = s.start;
}
for (const group of ['topics', 'memories', 'lessons']) {
  assert(archive[group].length > 0, `${group} must be populated from the source`);
  assert(new Set(archive[group].map(i=>i.id)).size === archive[group].length, `Duplicate ${group} ids`);
  for (const item of archive[group]) {
    assert(item.title && (item.summary || item.body), `Incomplete ${group}/${item.id}`);
    const ranges = item.ranges || [[item.start,item.end]];
    assert(ranges.length > 0, `${item.id} lacks source references`);
    for (const [start,end] of ranges) {
      assert(start >= 0 && end > start && end <= transcript.duration, `Bad range in ${item.id}`);
      assert(transcript.segments.some(s=>!s.redacted && s.end > start && s.start < end), `No speech in ${item.id}`);
    }
  }
}
for (const gap of transcript.redactions) {
  assert(transcript.segments.some(s=>s.redacted && s.start===gap.start && s.end===gap.end));
  assert(!transcript.segments.some(s=>!s.redacted && s.start<gap.end && s.end>gap.start), 'Private time range must not contain public speech');
  for (const memory of archive.memories) assert(memory.end<=gap.start || memory.start>=gap.end);
}
const waveform=read('waveform');
for(const gap of transcript.redactions) assert(waveform.slice(gap.start+1,gap.end-1).every(n=>n===0), 'Redacted waveform must be silent');
const media = fs.readFileSync('site/media/electrical.m4a');
assert.notEqual(transcript.publicAudioSha256, 'A2E3D35407030F1332292DEA8955DBC4865E8FF57452DC49A043B9CB0E8C004E', 'The unredacted original must never be published');
assert.equal(crypto.createHash('sha256').update(media).digest('hex').toUpperCase(), transcript.publicAudioSha256);
assert(fs.readFileSync('site/data/transcript.vtt','utf8').startsWith('WEBVTT'));
assert(!fs.readFileSync('site/index.html','utf8').includes('sandbox:'));
const size = fs.statSync('site/data/transcript.json').size + fs.statSync('site/data/archive.json').size;
assert(size < 3_000_000, 'Initial text payload should stay below 3MB');
console.log(JSON.stringify({ok:true, segments:transcript.segments.length, topics:archive.topics.length, memories:archive.memories.length, lessons:archive.lessons.length, textBytes:size, publicAudioHashVerified:true},null,2));
