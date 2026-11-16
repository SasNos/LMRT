// Registration of the native voice host (host/), used by scripts/install-host.mjs and by the reader.
export const HOST_NAME = 'de.sasnos.lmrt.tts';
const ID_LENGTH = 32;

// Chrome's extension id: the first 32 hex digits of the SHA-256 of the public key, written with the letters a to p.
export function extensionIdFromDigest(hex) {
  if (typeof hex !== 'string' || !/^[0-9a-f]{32,}$/.test(hex)) throw new Error('Not a SHA-256 hex digest');
  return [...hex.slice(0, ID_LENGTH)].map((digit) => String.fromCharCode(97 + parseInt(digit, 16))).join('');
}

// The host manifest Chrome reads from the registry: only this extension may start the host.
export function hostManifest(path, extensionId) {
  if (!/^[a-p]{32}$/.test(extensionId)) throw new Error('Not an extension id');
  return {
    name: HOST_NAME,
    description: 'LMRT read-aloud voices (Pocket TTS)',
    path,
    type: 'stdio',
    allowed_origins: [`chrome-extension://${extensionId}/`],
  };
}
