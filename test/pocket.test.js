import test from 'node:test';
import assert from 'node:assert/strict';
import { CANCELLED, createPocketClient, parseHostMessage, pcmToFloat } from '../src/pocket.js';

const base64 = (values) => Buffer.from(Int16Array.from(values).buffer).toString('base64');
const voice = { pocketLang: 'german', pocketVoice: 'juergen' };

test('pcm is decoded from little-endian 16-bit samples', () => {
  assert.deepEqual([...pcmToFloat(base64([0, 16384, -32768, 32767]))], [0, 0.5, -1, 32767 / 32768]);
  assert.deepEqual([...pcmToFloat('')], []);
});

test('broken pcm is refused', () => {
  assert.equal(pcmToFloat('not base64 !'), null);
  assert.equal(pcmToFloat(Buffer.from([1, 2, 3]).toString('base64')), null, 'odd byte count');
});

test('host messages are reduced to known fields', () => {
  assert.deepEqual(parseHostMessage({ type: 'status', voices: { german: ['juergen', 'anna'], klingon: ['x'] } }), {
    type: 'status',
    voices: { german: ['juergen', 'anna'], english: [] },
  });
  const chunk = parseHostMessage({ type: 'chunk', id: 3, sr: 24000, pcm: base64([16384]) });
  assert.equal(chunk.id, 3);
  assert.equal(chunk.sampleRate, 24000);
  assert.deepEqual([...chunk.samples], [0.5]);
  assert.deepEqual(parseHostMessage({ type: 'status' }), { type: 'status', voices: { german: [], english: [] } });
  assert.deepEqual(parseHostMessage({ type: 'done', id: 3 }), { type: 'done', id: 3 });
  assert.deepEqual(parseHostMessage({ type: 'error', id: 3, message: 'x'.repeat(500) }), {
    type: 'error',
    id: 3,
    message: 'x'.repeat(300),
  });
  assert.deepEqual(parseHostMessage({ type: 'error' }), { type: 'error', id: null, message: 'Voice error' });
});

test('garbage from the host is ignored', () => {
  const garbage = [
    null,
    'text',
    42,
    {},
    { type: 'ready' },
    { type: 'status', voices: { german: ['../evil', 'UPPER', 'ok_name', 7, 'ä'] } },
    { type: 'chunk', id: 0, sr: 24000, pcm: '' },
    { type: 'chunk', id: 1, sr: 100, pcm: '' },
    { type: 'chunk', id: 1, sr: 200000, pcm: '' },
    { type: 'chunk', id: 1, sr: 24000.5, pcm: '' },
    { type: 'chunk', id: 1, sr: 24000, pcm: 5 },
    { type: 'chunk', id: 1, sr: 24000, pcm: '!!' },
    { type: 'done', id: -1 },
    { type: 'done', id: '1' },
  ];
  const results = garbage.map(parseHostMessage);
  assert.deepEqual(results[5], { type: 'status', voices: { german: ['ok_name'], english: [] } });
  results.splice(5, 1);
  assert.deepEqual(results, new Array(results.length).fill(null));
});

function fakePort() {
  const listeners = { message: [], disconnect: [] };
  return {
    sent: [],
    postMessage(message) {
      this.sent.push(message);
    },
    onMessage: { addListener: (fn) => listeners.message.push(fn) },
    onDisconnect: { addListener: (fn) => listeners.disconnect.push(fn) },
    receive: (message) => listeners.message.forEach((fn) => fn(message)),
    drop: () => listeners.disconnect.forEach((fn) => fn()),
  };
}

function setup(reasonText = 'Specified native messaging host not found.', connectError = null) {
  const ports = [];
  const errors = [];
  const client = createPocketClient({
    connect: () => {
      if (connectError) throw connectError;
      ports.push(fakePort());
      return ports.at(-1);
    },
    reason: () => reasonText,
    onError: (message) => errors.push(message),
  });
  return { client, ports, errors };
}

test('a sentence is sent once and its chunks are joined', async () => {
  const { client, ports } = setup();
  const spoken = client.synthesize('Hallo.', voice);
  const [port] = ports;
  assert.deepEqual(port.sent, [{ op: 'speak', id: 1, lang: 'german', voice: 'juergen', text: 'Hallo.' }]);
  port.receive({ type: 'chunk', id: 1, sr: 24000, pcm: base64([16384]) });
  port.receive({ type: 'chunk', id: 99, sr: 24000, pcm: base64([1]) });
  port.receive('garbage');
  port.receive({ type: 'chunk', id: 1, sr: 24000, pcm: base64([-16384]) });
  port.receive({ type: 'done', id: 1 });
  const { samples, sampleRate } = await spoken;
  assert.deepEqual([...samples], [0.5, -0.5]);
  assert.equal(sampleRate, 24000);
});

test('an error of the host rejects only its own sentence', async () => {
  const { client, ports } = setup();
  const first = client.synthesize('a', voice);
  const second = client.synthesize('b', voice);
  ports[0].receive({ type: 'error', id: 1, message: 'invalid request' });
  ports[0].receive({ type: 'done', id: 2 });
  await assert.rejects(first, /invalid request/);
  assert.equal((await second).samples.length, 0);
  assert.equal(ports.length, 1, 'one port for both');
});

test('status lists the installed voices; warm loads a voice ahead', async () => {
  const { client, ports } = setup();
  const status = client.status();
  client.warm(voice);
  ports[0].receive({ type: 'status', voices: { german: ['juergen'], english: ['alba'] } });
  assert.deepEqual(await status, { german: ['juergen'], english: ['alba'] });
  assert.deepEqual(ports[0].sent, [{ op: 'status' }, { op: 'warm', lang: 'german', voice: 'juergen' }]);
});

test('a missing or stopped host rejects what is waiting, with the reason; the next call connects again', async () => {
  const { client, ports } = setup();
  const status = client.status();
  const spoken = client.synthesize('a', voice);
  ports[0].drop();
  await assert.rejects(status, /host not found/);
  await assert.rejects(spoken, /host not found/);
  client.warm(voice);
  assert.equal(ports.length, 2);
});

test('without a reason the stop is still reported', async () => {
  const { client, ports } = setup(null);
  const spoken = client.synthesize('a', voice);
  ports[0].drop();
  await assert.rejects(spoken, /voice helper stopped/);
});

test('cancel stops every waiting sentence in the engine', async () => {
  const { client, ports } = setup();
  const first = client.synthesize('a', voice);
  const second = client.synthesize('b', voice);
  client.cancelAll();
  await assert.rejects(first, /cancelled/);
  await assert.rejects(second, /cancelled/);
  assert.deepEqual(ports[0].sent.slice(2), [
    { op: 'cancel', id: 1 },
    { op: 'cancel', id: 2 },
  ]);
  ports[0].receive({ type: 'done', id: 1 });
  client.cancelAll();
  assert.equal(ports[0].sent.length, 4, 'nothing left to cancel');
});

test('cancel can spare one sentence, the prefetched one', async () => {
  const { client, ports } = setup();
  const stale = client.synthesize('a', voice);
  const next = client.synthesize('b', voice);
  client.cancelAll(next);
  await assert.rejects(stale, (error) => error.message === CANCELLED);
  ports[0].receive({ type: 'done', id: 2 });
  assert.equal((await next).samples.length, 0);
  assert.deepEqual(ports[0].sent.at(-1), { op: 'cancel', id: 1 });
});

test('errors without a sentence are reported, not dropped', () => {
  const { client, ports, errors } = setup();
  client.warm(voice);
  ports[0].receive({ type: 'error', id: null, message: 'Pocket TTS is not installed' });
  ports[0].receive({ type: 'error', id: 77, message: 'unknown job' });
  assert.deepEqual(errors, ['Pocket TTS is not installed', 'unknown job']);
});

test('a host that cannot be started rejects the sentence and reports a failed warm-up', async () => {
  const { client, errors } = setup(null, new Error('Access to the native messaging host is forbidden.'));
  await assert.rejects(client.synthesize('a', voice), /forbidden/);
  client.warm(voice);
  assert.deepEqual(errors, ['Access to the native messaging host is forbidden.']);
  client.cancelAll();
});
