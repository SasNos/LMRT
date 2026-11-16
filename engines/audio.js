// Browser binding (not unit-tested, see docs/STATUS.md): plays PCM samples through Web Audio.
export function createAudio() {
  let context = null;
  const get = () => (context ??= new AudioContext());
  return {
    play(samples, sampleRate, onended) {
      const ctx = get();
      const buffer = ctx.createBuffer(1, samples.length, sampleRate);
      buffer.copyToChannel(samples, 0);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.onended = onended;
      source.start();
      return {
        stop() {
          source.onended = null;
          source.stop();
        },
      };
    },
    pause: () => context?.suspend(),
    resume: () => context?.resume(),
  };
}
