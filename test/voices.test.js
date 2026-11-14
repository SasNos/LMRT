import test from 'node:test';
import assert from 'node:assert/strict';
import { buildVoiceOptions, pickDefaultVoice, pocketVoices, resolveVoice, voiceId, voiceLabel } from '../src/voices.js';

const system = [
  { voiceURI: 'sys-en', name: 'Sys En', lang: 'en-US', default: false },
  { voiceURI: 'sys-de', name: 'Sys De', lang: 'de-DE', default: true },
];
const pocket = pocketVoices({ german: ['juergen', 'peter_yearsley'], english: ['alba'] });

test('Pocket TTS voices come from the host status, per language', () => {
  assert.deepEqual(pocket[0], {
    id: 'pocket:german:juergen',
    neural: true,
    name: 'Juergen',
    lang: 'de-DE',
    pocketLang: 'german',
    pocketVoice: 'juergen',
  });
  assert.equal(pocket[1].name, 'Peter Yearsley');
  assert.equal(pocket[2].lang, 'en-US');
  assert.deepEqual(pocketVoices(null), []);
  assert.deepEqual(pocketVoices({ german: [] }), []);
});

test('ids and labels for both kinds', () => {
  assert.equal(voiceId(pocket[0]), 'pocket:german:juergen');
  assert.equal(voiceId(system[0]), 'sys-en');
  assert.equal(voiceLabel(pocket[0]), 'Juergen (de-DE, Pocket TTS)');
  assert.equal(voiceLabel(system[1]), 'Sys De (de-DE, system)');
});

test('a stored id finds its voice; an unknown or removed one finds nothing', () => {
  assert.equal(resolveVoice('pocket:german:juergen', system, pocket), pocket[0]);
  assert.equal(resolveVoice('sys-de', system, pocket), system[1]);
  assert.equal(resolveVoice('pocket:german:anna', system, pocket), null);
  assert.equal(resolveVoice('sys-de', system, []), system[1]);
});

test('the list shows Pocket TTS voices first, then the system voices', () => {
  assert.deepEqual(
    buildVoiceOptions(system, pocket).map((o) => o.id),
    ['pocket:german:juergen', 'pocket:german:peter_yearsley', 'pocket:english:alba', 'sys-en', 'sys-de'],
  );
  assert.deepEqual(buildVoiceOptions(system, pocket)[0], {
    id: 'pocket:german:juergen',
    label: 'Juergen (de-DE, Pocket TTS)',
    lang: 'de-DE',
  });
});

test('the default is a Pocket TTS voice of the language, else the system default, else the first, else none', () => {
  assert.equal(pickDefaultVoice(system, pocket, 'de-AT'), pocket[0]);
  assert.equal(pickDefaultVoice(system, pocket, 'en'), pocket[2]);
  assert.equal(pickDefaultVoice(system, pocket, 'fr-FR'), system[1]);
  assert.equal(pickDefaultVoice(system, pocket, undefined), system[1]);
  assert.equal(pickDefaultVoice([system[0]], [], 'de'), system[0]);
  assert.equal(pickDefaultVoice([], [], 'de'), null);
});
