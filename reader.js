// Thin DOM glue. All logic lives in src/ and is unit-tested.
import { buildChunks } from './src/chunker.js';
import { ACCEPT, checkFile } from './src/files.js';
import { createPlayer } from './src/player.js';
import { MAX_RATE, MIN_RATE, RATE_STEP, SETTINGS_KEY } from './src/constants.js';
import { normalizeSettings } from './src/settings.js';
import { createNeuralSynth } from './src/neural-synth.js';
import { createRouterSynth } from './src/router-synth.js';
import { buildVoiceOptions, pickDefaultVoice, resolveVoice, voiceSize } from './src/voices.js';
import { createAudio } from './engines/audio.js';
import { installVoice, installedVoiceIds, remainingBytes, removeVoice } from './engines/install.js';

const $ = (id) => document.getElementById(id);
const els = {
  file: $('file'),
  prev: $('prev'),
  toggle: $('toggle'),
  next: $('next'),
  stop: $('stop'),
  rate: $('rate'),
  rateOut: $('rate-out'),
  voice: $('voice'),
  install: $('install'),
  remove: $('remove'),
  status: $('status'),
  doc: $('doc'),
};
els.file.accept = ACCEPT;
els.rate.min = String(MIN_RATE);
els.rate.max = String(MAX_RATE);
els.rate.step = String(RATE_STEP);

const MESSAGES = {
  unsupported: `Unsupported file. Supported: ${ACCEPT}`,
  'too-large': 'File is too large.',
};

let settings = normalizeSettings(localStorage.getItem(SETTINGS_KEY));
let blockEls = [];
let chunks = [];
let currentBlock = -1;
let playerStatus = 'idle';

let installed = new Set();
let hasWebGpu = false;

// The heavy engine (onnxruntime and the phonemizer) is only loaded when a neural voice speaks.
const synth = createRouterSynth({
  system: speechSynthesis,
  neural: createNeuralSynth({
    audio: createAudio(),
    synthesize: async (text, voice, speed) => {
      try {
        const engine = await import(voice.engine === 'kokoro' ? './dist/kokoro.js' : './dist/piper.js');
        return await engine.synthesize(text, voice, speed);
      } catch (error) {
        console.error(error);
        els.status.textContent = `Voice error: ${error.message}. Run "npm run build" if dist/ is missing.`;
        throw error;
      }
    },
  }),
});

const player = createPlayer({
  synth,
  createUtterance: (text, voice) => (voice?.neural ? { text } : new SpeechSynthesisUtterance(text)),
  onState: render,
  schedule: (fn, ms) => {
    const timer = setTimeout(fn, ms);
    return () => clearTimeout(timer);
  },
});

function render({ status, index, total, chunk }) {
  playerStatus = status;
  const loaded = total > 0;
  els.toggle.textContent = status === 'playing' ? 'Pause' : status === 'paused' ? 'Resume' : 'Play';
  els.toggle.disabled = !loaded;
  els.stop.disabled = status === 'idle';
  els.prev.disabled = !loaded;
  els.next.disabled = !loaded;
  if (loaded)
    els.status.textContent = `${status === 'idle' ? 'Ready' : status === 'paused' ? 'Paused' : 'Reading'}: part ${index + 1} of ${total}`;
  const target = status === 'idle' && index === 0 ? -1 : (chunk?.blockIndex ?? -1);
  if (target !== currentBlock) {
    blockEls[currentBlock]?.classList.remove('current');
    currentBlock = target;
    const el = blockEls[target];
    el?.classList.add('current');
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }
}

function showBlocks(blocks) {
  els.doc.replaceChildren();
  currentBlock = -1;
  blockEls = blocks.map((block, blockIndex) => {
    const el = document.createElement('p');
    el.className = 'block';
    el.dataset.kind = block.kind;
    el.textContent = block.text;
    if (block.speak) {
      el.addEventListener('click', () => {
        const from = chunks.findIndex((c) => c.blockIndex === blockIndex);
        player.play(from);
      });
    }
    els.doc.append(el);
    return el;
  });
}

async function openFile(file) {
  const check = checkFile(file);
  if (!check.ok) {
    els.status.textContent = MESSAGES[check.error];
    return;
  }
  try {
    const blocks = check.parse(await file.text());
    chunks = buildChunks(blocks);
    showBlocks(blocks);
    player.load(chunks);
    if (!chunks.length) els.status.textContent = 'Nothing to read in this file.';
    else document.title = `${file.name} – LMRT`;
  } catch {
    els.status.textContent = 'Could not read this file.';
  }
}

function saveSettings() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Storage may be blocked; settings then last for this tab only.
  }
}

function selectedVoice() {
  return resolveVoice(els.voice.value, speechSynthesis.getVoices(), hasWebGpu);
}

// A neural voice that is not installed yet is never spoken: the system voice stands in until it is.
function applyVoice() {
  const voice = selectedVoice();
  const needsInstall = Boolean(voice?.neural) && !installed.has(voice.id);
  els.install.hidden = !needsInstall;
  els.remove.hidden = !voice?.neural || needsInstall;
  if (needsInstall) {
    const label = (bytes) => `Install voice (${Math.round(bytes / 1e6)} MB from huggingface.co)`;
    els.install.textContent = label(voiceSize(voice));
    // Part of the files may already be stored (the Kokoro model is shared by its voices).
    remainingBytes(voice)
      .then((bytes) => {
        if (selectedVoice() === voice) els.install.textContent = label(bytes);
      })
      .catch(() => {});
  }
  player.setVoice(needsInstall ? pickDefaultVoice(speechSynthesis.getVoices(), installed, voice.lang) : voice);
}

function fillVoices() {
  const systemVoices = speechSynthesis.getVoices();
  const options = buildVoiceOptions(systemVoices, installed, hasWebGpu);
  els.voice.replaceChildren(
    ...options.map(({ id, label, lang }) => {
      const option = new Option(label, id);
      option.lang = lang;
      return option;
    }),
  );
  const saved = resolveVoice(settings.voiceUri, systemVoices, hasWebGpu);
  const chosen = saved ?? pickDefaultVoice(systemVoices, installed, navigator.language);
  els.voice.value = chosen ? (chosen.neural ? chosen.id : chosen.voiceURI) : '';
  applyVoice();
}

async function refreshInstalled() {
  const adapter = await navigator.gpu?.requestAdapter?.().catch(() => null);
  // Kokoro runs in full precision (fp32) on the GPU: WebGPU is enough.
  hasWebGpu = Boolean(adapter);
  installed = await installedVoiceIds();
  fillVoices();
}

async function runVoiceTask(task, doneMessage) {
  const voice = selectedVoice();
  els.install.disabled = true;
  els.remove.disabled = true;
  try {
    await task(voice);
    els.status.textContent = doneMessage(voice);
  } catch (error) {
    els.status.textContent = `Voice task failed: ${error.message}`;
  } finally {
    els.install.disabled = false;
    els.remove.disabled = false;
    await refreshInstalled();
  }
}

els.file.addEventListener('change', () => els.file.files[0] && openFile(els.file.files[0]));
els.toggle.addEventListener('click', () => {
  if (playerStatus === 'playing') player.pause();
  else player.play();
});
els.stop.addEventListener('click', () => player.stop());
els.prev.addEventListener('click', () => player.seek(-1));
els.next.addEventListener('click', () => player.seek(1));
els.rate.addEventListener('input', () => {
  settings = { ...settings, rate: Number(els.rate.value) };
  els.rateOut.textContent = `${settings.rate.toFixed(1)}×`;
  player.setRate(settings.rate);
  saveSettings();
});
els.voice.addEventListener('change', () => {
  settings = { ...settings, voiceUri: els.voice.value };
  applyVoice();
  saveSettings();
});
els.install.addEventListener('click', () =>
  runVoiceTask(
    (voice) =>
      installVoice(voice, (loaded, total) => {
        els.status.textContent = `Downloading voice: ${Math.round((100 * loaded) / total)} %`;
      }),
    (voice) => `Voice installed: ${voice.name}`,
  ),
);
els.remove.addEventListener('click', () => runVoiceTask(removeVoice, (voice) => `Voice removed: ${voice.name}`));

for (const type of ['dragenter', 'dragover']) {
  document.addEventListener(type, (event) => {
    event.preventDefault();
    els.doc.classList.add('dragging');
  });
}
for (const type of ['dragleave', 'drop']) {
  document.addEventListener(type, () => els.doc.classList.remove('dragging'));
}
document.addEventListener('drop', (event) => {
  event.preventDefault();
  if (event.dataTransfer?.files[0]) openFile(event.dataTransfer.files[0]);
});
window.addEventListener('pagehide', () => synth.cancel());

els.rate.value = String(settings.rate);
els.rateOut.textContent = `${settings.rate.toFixed(1)}×`;
player.setRate(settings.rate);
speechSynthesis.addEventListener('voiceschanged', fillVoices);
fillVoices();
refreshInstalled();
