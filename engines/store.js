// Browser binding (not unit-tested, see docs/STATUS.md): voice files live in the Cache API of this extension.
const CACHE_NAME = 'lmrt-voices';
const open = () => caches.open(CACHE_NAME);
const address = (name) => `https://lmrt.invalid/voices/${encodeURIComponent(name)}`;

export async function readFile(name) {
  const cache = await open();
  const response = await cache.match(address(name));
  return response ? new Uint8Array(await response.arrayBuffer()) : null;
}

export async function writeFile(name, bytes) {
  const cache = await open();
  await cache.put(address(name), new Response(bytes));
}

export async function hasFile(name) {
  const cache = await open();
  return Boolean(await cache.match(address(name)));
}

export async function removeFile(name) {
  const cache = await open();
  await cache.delete(address(name));
}
