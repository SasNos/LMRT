const MAX_PHONEMES = 20000;

// piper_phonemize prints one JSON line {"phonemes": [...]} for the input text. Its own "phoneme_ids" are not used:
// they follow a built-in table, while every voice has its own (voice config: phoneme_id_map).
export function parsePhonemes(line) {
  let data;
  try {
    data = JSON.parse(line);
  } catch {
    throw new Error('Phonemizer returned invalid output');
  }
  const phonemes = data?.phonemes;
  const valid =
    Array.isArray(phonemes) &&
    phonemes.length > 0 &&
    phonemes.length <= MAX_PHONEMES &&
    phonemes.every((p) => typeof p === 'string');
  if (!valid) throw new Error('Phonemizer returned invalid output');
  return phonemes;
}

// Piper input: start symbol, a pad after it and after every phoneme, end symbol. Unknown phonemes are skipped.
export function phonemeIds(phonemes, idMap) {
  const ids = [...idMap['^'], ...idMap._];
  for (const p of phonemes) if (Object.hasOwn(idMap, p)) ids.push(...idMap[p], ...idMap._);
  return [...ids, ...idMap.$];
}

// Plain values for the model inputs. A higher speed shortens length_scale.
export function piperRunInputs(config, ids, speed) {
  const { noise_scale: noise, length_scale: length, noise_w: noiseW } = config.inference;
  return {
    ids,
    scales: [noise, length / speed, noiseW],
    speaker: Object.keys(config.speaker_id_map ?? {}).length ? 0 : null,
  };
}

// Every entry is a non-empty list of ids inside the model's embedding table; ^ _ $ must exist.
function validIdMap(map, numSymbols) {
  if (!map || typeof map !== 'object' || Array.isArray(map)) return false;
  const limit = Number.isFinite(numSymbols) ? numSymbols : Infinity;
  const okList = (ids) =>
    Array.isArray(ids) && ids.length > 0 && ids.every((i) => Number.isInteger(i) && i >= 0 && i < limit);
  return ['^', '_', '$'].every((k) => Object.hasOwn(map, k)) && Object.values(map).every(okList);
}

export function parsePiperConfig(text) {
  let config;
  try {
    config = JSON.parse(text);
  } catch {
    throw new Error('Voice configuration is invalid');
  }
  const inference = config?.inference;
  const valid =
    typeof config?.espeak?.voice === 'string' &&
    Number.isFinite(config?.audio?.sample_rate) &&
    [inference?.noise_scale, inference?.length_scale, inference?.noise_w].every(Number.isFinite);
  if (!valid || !validIdMap(config.phoneme_id_map, config.num_symbols)) {
    throw new Error('Voice configuration is invalid');
  }
  return config;
}
