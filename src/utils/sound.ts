import { Platform } from 'react-native';

const bell = (
  ctx: AudioContext,
  freq: number,
  startTime: number,
  gain: number,
  decay: number,
) => {
  const osc = ctx.createOscillator();
  const gainNode = ctx.createGain();
  osc.connect(gainNode);
  gainNode.connect(ctx.destination);
  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, startTime);
  gainNode.gain.setValueAtTime(0, startTime);
  gainNode.gain.linearRampToValueAtTime(gain, startTime + 0.006);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + decay);
  osc.start(startTime);
  osc.stop(startTime + decay);

  // Bell-like inharmonic partial (ratio 2.756 from acoustic bell research)
  const osc2 = ctx.createOscillator();
  const gain2 = ctx.createGain();
  osc2.connect(gain2);
  gain2.connect(ctx.destination);
  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(freq * 2.756, startTime);
  gain2.gain.setValueAtTime(0, startTime);
  gain2.gain.linearRampToValueAtTime(gain * 0.35, startTime + 0.006);
  gain2.gain.exponentialRampToValueAtTime(0.0001, startTime + decay * 0.55);
  osc2.start(startTime);
  osc2.stop(startTime + decay * 0.55);
};

// Single habit completed — C5 → E5 → G5 ascending arpeggio
const playHabitCompleteWeb = () => {
  try {
    const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx: AudioContext = new AudioCtx();
    const t = ctx.currentTime;
    bell(ctx, 523.25, t, 0.14, 1.2);        // C5
    bell(ctx, 659.25, t + 0.09, 0.11, 1.1); // E5
    bell(ctx, 783.99, t + 0.18, 0.09, 1.0); // G5
  } catch (_) {}
};

// All habits done — C5 E5 G5 C6 full chord swell
const playAllDoneWeb = () => {
  try {
    const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx: AudioContext = new AudioCtx();
    const t = ctx.currentTime;
    bell(ctx, 523.25, t, 0.13, 1.8);        // C5
    bell(ctx, 659.25, t + 0.06, 0.11, 1.6); // E5
    bell(ctx, 783.99, t + 0.12, 0.10, 1.5); // G5
    bell(ctx, 1046.5, t + 0.20, 0.09, 1.4); // C6 — crowning note
  } catch (_) {}
};

export const playHabitComplete = () => {
  if (Platform.OS === 'web') playHabitCompleteWeb();
};

export const playAllDone = () => {
  if (Platform.OS === 'web') playAllDoneWeb();
};
