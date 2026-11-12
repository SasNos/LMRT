export const ALLOWED_PREFIX = 'https://huggingface.co/';

// Downloads one file into memory with progress. Never reads more than `size` bytes.
export async function downloadBytes({ fetchFn, url, size, onProgress = () => {} }) {
  if (typeof url !== 'string' || !url.startsWith(ALLOWED_PREFIX)) throw new Error('Download address is not allowed');
  const response = await fetchFn(url);
  if (!response.ok) throw new Error(`Download failed (${response.status})`);
  const chunks = [];
  let loaded = 0;
  const reader = response.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    loaded += value.length;
    if (loaded > size) {
      await reader.cancel();
      throw new Error('Download is larger than expected');
    }
    chunks.push(value);
    onProgress(loaded, size);
  }
  const bytes = new Uint8Array(loaded);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
}
