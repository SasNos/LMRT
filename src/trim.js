import { TRIM_MARGIN_MS, TRIM_THRESHOLD } from './constants.js';

// Neural voices pad every utterance with about a quarter second of silence on both sides. Trimming it lets the
// reader set the pauses itself (see BLOCK_PAUSE_MS). A buffer that is silent or not finite is returned unchanged.
export function trimSilence(samples, sampleRate) {
  let peak = 0;
  for (const value of samples) peak = Math.max(peak, Math.abs(value));
  if (!(peak > 0) || !Number.isFinite(peak)) return samples;
  const limit = peak * TRIM_THRESHOLD;
  let first = 0;
  while (Math.abs(samples[first]) < limit) first += 1;
  let last = samples.length - 1;
  while (Math.abs(samples[last]) < limit) last -= 1;
  const margin = Math.round((sampleRate * TRIM_MARGIN_MS) / 1000);
  return samples.subarray(Math.max(0, first - margin), Math.min(samples.length, last + 1 + margin));
}
