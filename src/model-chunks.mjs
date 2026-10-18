// Sequential reads bound temporary download memory to one 20 MiB chunk.
export async function loadModelChunks(manifestUrl, signal) {
  const response = await fetch(manifestUrl, { signal, cache: 'no-cache' });
  if (!response.ok) throw new Error(`Model manifest HTTP ${response.status}`);
  const manifest = await response.json();
  if (manifest.version !== 1 || !Number.isSafeInteger(manifest.size) || manifest.size <= 0 || manifest.size > 256 * 1024 * 1024 || !Array.isArray(manifest.parts) || !manifest.parts.length) throw new Error('Invalid model manifest');
  if (manifest.parts.some(p => !/^character-[a-f0-9]{64}\.bin$/.test(p.file) || !Number.isSafeInteger(p.size) || p.size <= 0 || p.size > 20 * 1024 * 1024 || !/^[a-f0-9]{64}$/.test(p.sha256)) || manifest.parts.reduce((sum, p) => sum + p.size, 0) !== manifest.size) throw new Error('Invalid model parts');
  const result = new Uint8Array(manifest.size);
  let offset = 0;
  for (const part of manifest.parts) {
    const response = await fetch(new URL(part.file, manifestUrl), { signal });
    if (!response.ok) throw new Error(`Model chunk HTTP ${response.status}`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length !== part.size) throw new Error('Incomplete model chunk');
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    const hash = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
    if (hash !== part.sha256) throw new Error('Model chunk checksum mismatch');
    result.set(bytes, offset);
    offset += bytes.length;
  }
  return result.buffer;
}
