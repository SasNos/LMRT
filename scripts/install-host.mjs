// Registers the native voice host for Chrome (Windows, current user, no admin): copies host/ to
// %LOCALAPPDATA%\Artisan\LMRT\host, writes the host manifest and points the registry key at it.
// Run: npm run install-host
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { HOST_NAME, extensionIdFromDigest, hostManifest } from '../src/native-host.js';

const localAppData = process.env.LOCALAPPDATA;
if (process.platform !== 'win32' || !localAppData) throw new Error('The voice host is set up for Windows only.');

const runtime = join(localAppData, 'Artisan', 'Letter', 'tts');
if (!existsSync(join(runtime, 'python', 'python.exe')) || !existsSync(join(runtime, 'tts_server.py'))) {
  console.warn(`Pocket TTS runtime not found in ${runtime}: install a voice in Letter first.`);
}

const target = join(localAppData, 'Artisan', 'LMRT', 'host');
mkdirSync(target, { recursive: true });
for (const file of ['lmrt_tts_host.py', 'lmrt_tts_host.bat']) copyFileSync(join('host', file), join(target, file));

const { key } = JSON.parse(readFileSync('manifest.json', 'utf8'));
const extensionId = extensionIdFromDigest(createHash('sha256').update(Buffer.from(key, 'base64')).digest('hex'));
const manifestPath = join(target, `${HOST_NAME}.json`);
writeFileSync(
  manifestPath,
  `${JSON.stringify(hostManifest(join(target, 'lmrt_tts_host.bat'), extensionId), null, 2)}\n`,
);

execFileSync('reg', [
  'add',
  `HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts\\${HOST_NAME}`,
  '/ve',
  '/t',
  'REG_SZ',
  '/d',
  manifestPath,
  '/f',
]);
console.log(`Voice host registered for extension ${extensionId}: ${manifestPath}`);
