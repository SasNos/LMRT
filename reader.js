// Thin DOM glue. All logic lives in src/ and is unit-tested.
import { buildChunks } from './src/chunker.js';
import { ACCEPT, checkFile } from './src/files.js';
import { createPlayer } from './src/player.js';
import { SETTINGS_KEY } from './src/constants.js';
import { findVoice, normalizeSettings } from './src/settings.js';

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

const MESSAGES = {
  unsupported: `Unsupported file. Supported: ${ACCEPT}`,
  'too-large': 'File is too large.',
};

let settings = normalizeSettings(localStorage.getItem(SETTINGS_KEY));
let blockEls = [];
let chunks = [];
let currentBlock = -1;
let playerStatus = 'idle';

const player = createPlayer({
  synth: speechSynthesis,
  createUtterance: (text) => new SpeechSynthesisUtterance(text),
  onState: render,
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

function fillVoices() {
  const voices = speechSynthesis.getVoices();
  els.voice.replaceChildren(
    ...voices.map((voice) => {
      const option = new Option(`${voice.name} (${voice.lang})`, voice.voiceURI);
      option.lang = voice.lang;
      return option;
    }),
  );
  const chosen = findVoice(voices, settings.voiceUri) ?? voices.find((v) => v.default) ?? voices[0] ?? null;
  els.voice.value = chosen?.voiceURI ?? '';
  player.setVoice(chosen);
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
  player.setVoice(findVoice(speechSynthesis.getVoices(), settings.voiceUri));
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
window.addEventListener('pagehide', () => speechSynthesis.cancel());

els.rate.value = String(settings.rate);
els.rateOut.textContent = `${settings.rate.toFixed(1)}×`;
player.setRate(settings.rate);
speechSynthesis.addEventListener('voiceschanged', fillVoices);
fillVoices();
