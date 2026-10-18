import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

export default defineConfig({
  plugins: [tailwindcss(), {
    name: 'character-model-chunks',
    apply: 'build',
    generateBundle() {
      const model = readFileSync(new URL('./public/models/character-rigged.glb', import.meta.url));
      if (model.toString('ascii', 0, 4) !== 'glTF') throw new Error('Missing GLB data. Run git lfs pull before building.');
      const parts = [];
      const chunkSize = 20 * 1024 * 1024;
      for (let offset = 0; offset < model.length; offset += chunkSize) {
        const bytes = model.subarray(offset, offset + chunkSize);
        const sha256 = createHash('sha256').update(bytes).digest('hex');
        const file = `character-${sha256}.bin`;
        this.emitFile({ type: 'asset', fileName: `models/${file}`, source: bytes });
        parts.push({ file, size: bytes.length, sha256 });
      }
      this.emitFile({ type: 'asset', fileName: 'models/character.json', source: JSON.stringify({ version: 1, size: model.length, parts }) });
    },
  }],
  // public/ currently contains only the original and rigged GLB. Only chunks
  // are deployed; the local dev server continues serving the original GLB.
  build: { copyPublicDir: false },
});
