// Generates the native chime WAV assets in assets/sounds/ from the same additive
// bell-synthesis parameters used by the web implementation in src/utils/sound.ts
// (two sine partials per note — fundamental + inharmonic ratio 2.756 — with a fast
// linear attack and exponential decay). Re-run after editing the note tables below
// if you want to retune any of the three chimes:
//   node scripts/generate-chime-sounds.mjs

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '..', 'assets', 'sounds');
const SAMPLE_RATE = 44100;

function bellEnvelope(t, gain, decay) {
  const attack = 0.006;
  if (t < attack) return (gain * t) / attack;
  const decayT = t - attack;
  const decayDur = decay - attack;
  if (decayDur <= 0) return 0;
  // exponential ramp from `gain` to 0.0001 over decayDur
  return gain * Math.pow(0.0001 / gain, decayT / decayDur);
}

function renderNotes(notes) {
  const totalDuration = Math.max(...notes.map((n) => n.start + n.decay)) + 0.05;
  const totalSamples = Math.ceil(totalDuration * SAMPLE_RATE);
  const buffer = new Float64Array(totalSamples);

  for (const { freq, start, gain, decay } of notes) {
    const startSample = Math.floor(start * SAMPLE_RATE);
    const decaySamples = Math.floor(decay * SAMPLE_RATE);
    const partialFreq = freq * 2.756;
    const partialGain = gain * 0.35;
    const partialDecay = decay * 0.55;

    for (let i = 0; i < decaySamples; i++) {
      const t = i / SAMPLE_RATE;
      const idx = startSample + i;
      if (idx >= totalSamples) break;
      const fundamental = bellEnvelope(t, gain, decay) * Math.sin(2 * Math.PI * freq * t);
      const partial = t < partialDecay
        ? bellEnvelope(t, partialGain, partialDecay) * Math.sin(2 * Math.PI * partialFreq * t)
        : 0;
      buffer[idx] += fundamental + partial;
    }
  }

  // normalize to avoid clipping when notes stack
  let peak = 0;
  for (let i = 0; i < buffer.length; i++) peak = Math.max(peak, Math.abs(buffer[i]));
  const scale = peak > 0 ? 0.85 / peak : 1;

  const pcm = new Int16Array(buffer.length);
  for (let i = 0; i < buffer.length; i++) {
    pcm[i] = Math.max(-32768, Math.min(32767, Math.round(buffer[i] * scale * 32767)));
  }
  return pcm;
}

function writeWav(filePath, pcm) {
  const blockAlign = 2; // mono, 16-bit
  const byteRate = SAMPLE_RATE * blockAlign;
  const dataSize = pcm.length * 2;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);       // fmt chunk size
  buffer.writeUInt16LE(1, 20);        // PCM
  buffer.writeUInt16LE(1, 22);        // mono
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(16, 34);       // bits per sample
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < pcm.length; i++) {
    buffer.writeInt16LE(pcm[i], 44 + i * 2);
  }
  writeFileSync(filePath, buffer);
}

// Single habit completed — C5 -> E5 -> G5 ascending arpeggio (mirrors playHabitCompleteWeb)
const habitComplete = [
  { freq: 523.25, start: 0, gain: 0.6, decay: 1.2 },
  { freq: 659.25, start: 0.09, gain: 0.5, decay: 1.1 },
  { freq: 783.99, start: 0.18, gain: 0.42, decay: 1.0 },
];

// All habits done today — C5 E5 G5 C6 full chord swell (mirrors playAllDoneWeb)
const allDone = [
  { freq: 523.25, start: 0, gain: 0.55, decay: 1.8 },
  { freq: 659.25, start: 0.06, gain: 0.48, decay: 1.6 },
  { freq: 783.99, start: 0.12, gain: 0.42, decay: 1.5 },
  { freq: 1046.5, start: 0.20, gain: 0.4, decay: 1.4 },
];

// Challenge complete — ascending run into a sustained crowning chord
const challengeComplete = [
  { freq: 523.25, start: 0, gain: 0.5, decay: 0.5 },
  { freq: 659.25, start: 0.08, gain: 0.5, decay: 0.5 },
  { freq: 783.99, start: 0.16, gain: 0.5, decay: 0.5 },
  { freq: 1046.5, start: 0.24, gain: 0.55, decay: 0.6 },
  { freq: 523.25, start: 0.34, gain: 0.42, decay: 2.0 },
  { freq: 783.99, start: 0.34, gain: 0.4, decay: 2.0 },
  { freq: 1046.5, start: 0.34, gain: 0.44, decay: 2.0 },
  { freq: 1318.5, start: 0.34, gain: 0.46, decay: 1.8 },
];

writeWav(join(OUT_DIR, 'habit-complete.wav'), renderNotes(habitComplete));
writeWav(join(OUT_DIR, 'all-done.wav'), renderNotes(allDone));
writeWav(join(OUT_DIR, 'challenge-complete.wav'), renderNotes(challengeComplete));

console.log('Wrote assets/sounds/{habit-complete,all-done,challenge-complete}.wav');
