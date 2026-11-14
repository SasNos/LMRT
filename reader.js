// Thin DOM glue. All logic lives in src/ and is unit-tested.
import { buildChunks } from './src/chunker.js';
import { ACCEPT, checkFile } from './src/files.js';
import { createPlayer } from './src/player.js';
import { MAX_RATE, MIN_RATE, RATE_STEP, SETTINGS_KEY } from './src/constants.js';
import { normalizeSettings } from './src/settings.js';
import { createNeuralSynth } from './src/neural-synth.js';
import { createRouterSynth } from './src/router-synth.js';
import { buildVoiceOptions, pickDefaultVoice, pocketVoices, resolveVoice, voiceId } from './src/voices.js';
import { CANCELLED, createPocketClient } from './src/pocket.js';
import { HOST_NAME } from './src/native-host.js';
import { createAudio } from './engines/audio.js';

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

let pocket = [];

// Pocket TTS runs in the native host (host/, registered by `npm run install-host`), started by Chrome on first use.
const pocketClient = createPocketClient({
  connect: () => chrome.runtime.connectNative(HOST_NAME),
  reason: () => chrome.runtime.lastError?.message,
  onError: (message) => {
    els.status.textContent = `Voice error: ${message}`;
  },
});

const synth = createRouterSynth({
  system: speechSynthesis,
  neural: createNeuralSynth({
    audio: createAudio(),
    abort: () => pocketClient.cancelAll(),
    // The client's own promise is returned: the synth keeps the prefetched one alive by identity.
    synthesize: (text, voice) => {
      const spoken = pocketClient.synthesize(text, voice);
      spoken.catch((error) => {
        if (error.message !== CANCELLED) els.status.textContent = `Voice error: ${error.message}`;
      });
      return spoken;
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
  return resolveVoice(els.voice.value, speechSynthesis.getVoices(), pocket);
}

// Loading a Pocket TTS voice takes seconds, so it starts when the voice is chosen (once per voice).
const warmed = new Set();
function applyVoice() {
  const voice = selectedVoice();
  player.setVoice(voice);
  if (voice?.neural && !warmed.has(voice.id)) {
    warmed.add(voice.id);
    pocketClient.warm(voice);
  }
}

function fillVoices() {
  const systemVoices = speechSynthesis.getVoices();
  els.voice.replaceChildren(
    ...buildVoiceOptions(systemVoices, pocket).map(({ id, label, lang }) => {
      const option = new Option(label, id);
      option.lang = lang;
      return option;
    }),
  );
  const chosen =
    resolveVoice(settings.voiceUri, systemVoices, pocket) ?? pickDefaultVoice(systemVoices, pocket, navigator.language);
  els.voice.value = chosen ? voiceId(chosen) : '';
  applyVoice();
}

// Without the host (not registered, Letter's runtime missing) only the system voices are listed.
async function loadPocketVoices() {
  try {
    pocket = pocketVoices(await pocketClient.status());
  } catch {
    pocket = [];
  }
  fillVoices();
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
loadPocketVoices();
