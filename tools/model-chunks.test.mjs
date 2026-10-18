import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { loadModelChunks } from '../src/model-chunks.mjs';

test('production chunks download and reconstruct the exact source GLB', async () => {
  const manifest = JSON.parse(await readFile('dist/models/character.json', 'utf8'));
  assert.equal(manifest.parts.length, 6);
  for (const p of manifest.parts) assert.ok(p.size <= 20 * 1024 * 1024);
  assert.ok(!(await readdir('dist/models')).some(name => name.endsWith('.glb')));
  let corrupt = false;
  let stalled = 0;
  const server = createServer(async (req, res) => {
    try {
      const name = req.url.split('/').pop();
      if (name !== 'character.json' && !manifest.parts.some(p => p.file === name)) { res.writeHead(404).end(); return; }
      if (name.endsWith('.bin') && stalled > 0) { stalled--; res.writeHead(200); res.write(Buffer.from([0])); return; }
      const data = await readFile(`dist/models/${name}`);
      if (corrupt && name.endsWith('.bin')) data[0] ^= 1;
      res.end(data);
    } catch { res.writeHead(500).end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const url = `http://127.0.0.1:${server.address().port}/models/character.json`;
    const restored = await loadModelChunks(url, new AbortController().signal);
    const source = await readFile('public/models/character-rigged.glb');
    const hash = bytes => createHash('sha256').update(bytes).digest('hex');
    assert.equal(hash(Buffer.from(restored)), hash(source));
    stalled = 1;
    const progress = [];
    const recovered = await loadModelChunks(url, undefined, value => progress.push(value), { idleMs: 500 });
    assert.equal(hash(Buffer.from(recovered)), hash(source));
    assert.ok(progress.some(p => p.attempt > 0));
    assert.equal(progress.at(-1).loaded, source.length);
    corrupt = true;
    await assert.rejects(loadModelChunks(url), /checksum mismatch/);
    const controller = new AbortController();
    controller.abort();
    await assert.rejects(loadModelChunks(url, controller.signal), { name: 'AbortError' });
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});
