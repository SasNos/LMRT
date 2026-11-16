// Sends each utterance to the neural or the system speech API, depending on its voice.
export function createRouterSynth({ system, neural }) {
  let active = system;
  return {
    speak(utterance) {
      active = utterance.voice?.neural ? neural : system;
      active.speak(utterance);
    },
    cancel() {
      system.cancel();
      neural.cancel();
    },
    pause: () => active.pause(),
    resume: () => active.resume(),
    prefetch(next) {
      if (next.voice?.neural) neural.prefetch(next);
    },
  };
}
