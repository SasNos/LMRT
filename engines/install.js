// Browser binding (not unit-tested, see docs/STATUS.md): downloads pinned voice files and stores them.
// Piper files go into LMRT's own store; Kokoro files go into the caches that kokoro-js reads.
import { downloadBytes } from '../src/download.js';
import { kokoroFilesFor, kokoroUrl } from '../src/kokoro.js';
import { matchesPin } from '../src/verify.js';
import { NEURAL_VOICES, piperUrls } from '../src/voices.js';
import { opfsCache } from './opfs-cache.js';
import { hasFile, removeFile, writeFile } from './store.js';

const piperName = (voice, kind) => `${voice.id}.${kind}`;

// Where a Kokoro file lives: the model files in the file system cache, the voice files in the Cache API.
async function kokoroCache(file) {
  return file.cache === 'opfs' ? opfsCache : caches.open(file.cache);
}

const kokoroCached = async (file) => Boolean(await (await kokoroCache(file)).match(kokoroUrl(file)));

// The files of a voice that are not stored yet, each with where it comes from and how it is stored.
async function missingFiles(voice) {
  if (voice.engine === 'kokoro') {
    const missing = [];
    for (const file of kokoroFilesFor(voice.kokoroVoice)) {
      if (await kokoroCached(file)) continue;
      const cache = await kokoroCache(file);
      missing.push({
        url: kokoroUrl(file),
        pin: file,
        store: (bytes) => cache.put(kokoroUrl(file), new Response(bytes)),
      });
    }
    return missing;
  }
  const urls = piperUrls(voice);
  const missing = [];
  for (const kind of ['json', 'onnx']) {
    if (await hasFile(piperName(voice, kind))) continue;
    missing.push({
      url: urls[kind],
      pin: voice.files[kind],
      store: (bytes) => writeFile(piperName(voice, kind), bytes),
    });
  }
  return missing;
}

export async function installedVoiceIds() {
  const ids = new Set();
  for (const voice of NEURAL_VOICES) {
    if ((await missingFiles(voice)).length === 0) ids.add(voice.id);
  }
  return ids;
}

export async function remainingBytes(voice) {
  return (await missingFiles(voice)).reduce((sum, file) => sum + file.pin.size, 0);
}

export async function installVoice(voice, onProgress) {
  const files = await missingFiles(voice);
  const total = files.reduce((sum, file) => sum + file.pin.size, 0);
  let done = 0;
  for (const file of files) {
    const base = done;
    const bytes = await downloadBytes({
      fetchFn: (url) => fetch(url),
      url: file.url,
      size: file.pin.size,
      onProgress: (loaded) => onProgress(base + loaded, total),
    });
    if (!(await matchesPin(bytes, file.pin))) throw new Error('Downloaded voice does not match its checksum');
    await file.store(bytes);
    done += file.pin.size;
  }
}

export async function removeVoice(voice) {
  if (voice.engine !== 'kokoro') {
    await removeFile(piperName(voice, 'onnx'));
    await removeFile(piperName(voice, 'json'));
    return;
  }
  const [shared, own] = [kokoroFilesFor(voice.kokoroVoice).slice(0, -1), kokoroFilesFor(voice.kokoroVoice).at(-1)];
  await (await kokoroCache(own)).delete(kokoroUrl(own));
  // The shared model stays while another Kokoro voice is installed.
  const others = NEURAL_VOICES.filter((other) => other.engine === 'kokoro' && other.id !== voice.id);
  for (const other of others) {
    if (await kokoroCached(kokoroFilesFor(other.kokoroVoice).at(-1))) return;
  }
  for (const file of shared) await (await kokoroCache(file)).delete(kokoroUrl(file));
}
