// The native host (host/lmrt_tts_host.py) driven the way Chrome drives it: length-prefixed JSON on stdin and stdout.
// A fake runtime stands in for Letter's: a models folder and a tts_server.py that echoes. Needs Python on PATH.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HOST = fileURLToPath(new URL('../host/lmrt_tts_host.py', import.meta.url));
const PYTHON = process.platform === 'win32' ? 'python' : 'python3';

const ECHO_ENGINE = `
import json, sys
for line in sys.stdin:
    job = json.loads(line)
    if job["op"] == "quit":
        break
    if job["op"] == "speak":
        if job["text"] == "crash":
            sys.exit(1)
        print(json.dumps({"type": "chunk", "id": job["id"], "sr": 24000, "pcm": "AAA="}), flush=True)
        print(json.dumps({"type": "done", "id": job["id"]}), flush=True)
    print("not json", flush=True)
`;

function runtime({ engine = ECHO_ENGINE, voices = ['juergen', 'Bad-Name', 'anna'] } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'lmrt-host-'));
  const german = join(dir, 'models', 'german');
  mkdirSync(join(german, 'voices'), { recursive: true });
  writeFileSync(join(german, 'model.safetensors'), '');
  for (const voice of voices) writeFileSync(join(german, 'voices', `${voice}.safetensors`), '');
  writeFileSync(join(german, 'voices', 'notes.txt'), '');
  mkdirSync(join(dir, 'models', 'english', 'voices'), { recursive: true });
  writeFileSync(join(dir, 'models', 'english', 'voices', 'alba.safetensors'), '');
  if (engine) writeFileSync(join(dir, 'tts_server.py'), engine);
  return dir;
}

const frame = (message) => {
  const data = Buffer.from(typeof message === 'string' ? message : JSON.stringify(message));
  const head = Buffer.alloc(4);
  head.writeUInt32LE(data.length);
  return Buffer.concat([head, data]);
};

// Sends the frames and collects every message until the host exits. stdin closes at once, or when `until(message)`
// is true, or not at all (close: false).
function talk(dir, frames, { close = true, until = null } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(PYTHON, ['-u', HOST], { env: { ...process.env, LMRT_TTS_RUNTIME: dir } });
    let buffer = Buffer.alloc(0);
    const messages = [];
    child.stdout.on('data', (data) => {
      buffer = Buffer.concat([buffer, data]);
      while (buffer.length >= 4 && buffer.length >= 4 + buffer.readUInt32LE(0)) {
        const length = buffer.readUInt32LE(0);
        const message = JSON.parse(buffer.subarray(4, 4 + length).toString('utf8'));
        messages.push(message);
        buffer = buffer.subarray(4 + length);
        if (until?.(message)) child.stdin.end();
      }
    });
    child.on('error', reject);
    child.on('exit', (code) => resolve({ code, messages }));
    for (const f of frames) child.stdin.write(f);
    if (close && !until) child.stdin.end();
  });
}

test('status lists only the voices with a valid name, of languages that have a model', async () => {
  const dir = runtime();
  const { messages, code } = await talk(dir, [frame({ op: 'status' })]);
  assert.deepEqual(messages, [{ type: 'status', voices: { german: ['anna', 'juergen'], english: [] } }]);
  assert.equal(code, 0);
  rmSync(dir, { recursive: true });
});

test('invalid requests are refused without starting the engine', async () => {
  const dir = runtime({ engine: null });
  const requests = [
    { op: 'speak', id: 1, lang: 'german', voice: '../evil', text: 'x' },
    { op: 'speak', id: 2, lang: 'klingon', voice: 'juergen', text: 'x' },
    { op: 'speak', id: true, lang: 'german', voice: 'juergen', text: 'x' },
    { op: 'speak', id: 4, lang: 'german', voice: 'juergen', text: '' },
    { op: 'speak', id: 5, lang: 'german', voice: 'juergen', text: 'x'.repeat(2001) },
    { op: 'cancel', id: 'x' },
    { op: 'rm -rf' },
    [1, 2],
  ];
  const { messages } = await talk(dir, [...requests.map(frame), frame('{not json')]);
  assert.deepEqual(
    messages.map((m) => [m.type, m.id, m.message]),
    [
      ['error', 1, 'invalid request'],
      ['error', 2, 'invalid request'],
      ['error', null, 'invalid request'],
      ['error', 4, 'invalid request'],
      ['error', 5, 'invalid request'],
      ['error', null, 'invalid request'],
      ['error', null, 'invalid request'],
      ['error', null, 'invalid request'],
    ],
  );
  rmSync(dir, { recursive: true });
});

test("without Letter's engine a valid request gets a clear error", async () => {
  const dir = runtime({ engine: null });
  const { messages } = await talk(dir, [
    frame({ op: 'speak', id: 1, lang: 'german', voice: 'juergen', text: 'Hallo.' }),
  ]);
  assert.deepEqual(messages, [{ type: 'error', id: 1, message: 'Pocket TTS is not installed (install it in Letter)' }]);
  rmSync(dir, { recursive: true });
});

test('valid requests reach the engine and its answers come back; garbage from the engine is dropped', async () => {
  const dir = runtime();
  const { messages, code } = await talk(
    dir,
    [
      frame({ op: 'warm', lang: 'german', voice: 'juergen' }),
      frame({ op: 'speak', id: 7, lang: 'german', voice: 'juergen', text: 'Hallo.' }),
    ],
    { until: (message) => message.type === 'done' },
  );
  assert.deepEqual(messages, [
    { type: 'chunk', id: 7, sr: 24000, pcm: 'AAA=' },
    { type: 'done', id: 7 },
  ]);
  assert.equal(code, 0);
  rmSync(dir, { recursive: true });
});

test('an engine that dies ends the host, so nothing waits forever', async () => {
  const dir = runtime();
  const { messages, code } = await talk(
    dir,
    [frame({ op: 'speak', id: 1, lang: 'german', voice: 'juergen', text: 'crash' })],
    {
      close: false,
    },
  );
  assert.deepEqual(messages, []);
  assert.equal(code, 0);
  rmSync(dir, { recursive: true });
});

test('a frame above the size limit ends the host', async () => {
  const dir = runtime();
  const head = Buffer.alloc(4);
  head.writeUInt32LE(2 * 1024 * 1024);
  const { messages, code } = await talk(dir, [head], { close: false });
  assert.deepEqual(messages, []);
  assert.equal(code, 0);
  rmSync(dir, { recursive: true });
});
