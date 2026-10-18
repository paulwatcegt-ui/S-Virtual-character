// A stalled connection must not leave the character silently loading forever.
async function readResponse(url, signal, consume, cache, idleMs) {
  const controller = new AbortController();
  const abort = () => controller.abort(signal.reason);
  signal?.throwIfAborted();
  signal?.addEventListener('abort', abort, { once: true });
  let timer;
  const touch = () => {
    clearTimeout(timer);
    timer = setTimeout(() => controller.abort(new Error('Model download stalled')), idleMs);
  };
  touch();
  try {
    const response = await fetch(url, { signal: controller.signal, cache });
    if (!response.ok) throw new Error(`Model HTTP ${response.status}`);
    return await consume(response, touch);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}

// Sequential streaming bounds temporary download memory to one chunk.
export async function loadModelChunks(manifestUrl, signal, onProgress = () => {}, { idleMs = 30000 } = {}) {
  const manifest = await readResponse(manifestUrl, signal, r => r.json(), 'no-cache', idleMs);
  if (manifest.version !== 1 || !Number.isSafeInteger(manifest.size) || manifest.size <= 0 || manifest.size > 256 * 1024 * 1024 || !Array.isArray(manifest.parts) || !manifest.parts.length) throw new Error('Invalid model manifest');
  if (manifest.parts.some(p => !/^character-[a-f0-9]{64}\.bin$/.test(p.file) || !Number.isSafeInteger(p.size) || p.size <= 0 || p.size > 20 * 1024 * 1024 || !/^[a-f0-9]{64}$/.test(p.sha256)) || manifest.parts.reduce((sum, p) => sum + p.size, 0) !== manifest.size) throw new Error('Invalid model parts');
  const result = new Uint8Array(manifest.size);
  let offset = 0;
  for (const part of manifest.parts) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await readResponse(new URL(part.file, manifestUrl), signal, async (response, touch) => {
          const reader = response.body.getReader();
          let received = 0;
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              touch();
              if (received + value.length > part.size) throw new Error('Oversized model chunk');
              result.set(value, offset + received);
              received += value.length;
              onProgress({ loaded: offset + received, total: manifest.size, attempt });
            }
          } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
          if (received !== part.size) throw new Error('Incomplete model chunk');
          const digest = await crypto.subtle.digest('SHA-256', result.subarray(offset, offset + part.size));
          const hash = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
          if (hash !== part.sha256) throw new Error('Model chunk checksum mismatch');
        }, attempt ? 'reload' : 'default', idleMs);
        break;
      } catch (error) {
        signal?.throwIfAborted();
        if (attempt === 2) throw error;
        onProgress({ loaded: offset, total: manifest.size, attempt: attempt + 1 });
      }
    }
    offset += part.size;
  }
  return result.buffer;
}
