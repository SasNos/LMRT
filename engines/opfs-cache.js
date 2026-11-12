// Browser binding (not unit-tested, see docs/STATUS.md): a cache with the interface transformers.js expects
// from `env.customCache`, stored in the origin private file system. Chrome's Cache API refuses entries
// above roughly 256 MB (measured 2026-11-11) and the Kokoro model is 326 MB.
const DIRECTORY = 'lmrt-kokoro';

const fileName = (request) => encodeURIComponent(typeof request === 'string' ? request : request.url);
const directory = async () => (await navigator.storage.getDirectory()).getDirectoryHandle(DIRECTORY, { create: true });

export const opfsCache = {
  async match(request) {
    try {
      const handle = await (await directory()).getFileHandle(fileName(request));
      return new Response(await handle.getFile());
    } catch {
      return undefined;
    }
  },
  async put(request, response) {
    const handle = await (await directory()).getFileHandle(fileName(request), { create: true });
    // The write is committed when the stream closes, so an interrupted download leaves no partial file.
    await response.body.pipeTo(await handle.createWritable());
  },
  async delete(request) {
    try {
      await (await directory()).removeEntry(fileName(request));
      return true;
    } catch {
      return false;
    }
  },
};
