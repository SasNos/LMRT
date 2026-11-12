const HEX = /^[0-9a-f]{64}$/;

export async function sha256Hex(bytes, subtle = globalThis.crypto.subtle) {
  const digest = new Uint8Array(await subtle.digest('SHA-256', bytes));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

// Downloaded data is untrusted: it must have exactly the pinned size and SHA-256.
export async function matchesPin(bytes, pin, subtle) {
  if (!(bytes instanceof Uint8Array) || !pin || !HEX.test(pin.sha256) || bytes.length !== pin.size) return false;
  return (await sha256Hex(bytes, subtle)) === pin.sha256;
}
