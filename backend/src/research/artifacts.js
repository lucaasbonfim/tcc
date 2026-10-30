import { mkdir, writeFile, readFile, unlink } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID, createHash } from 'node:crypto';
import { assert } from './errors.js';

export function createArtifactStore(directory = process.env.ARTIFACTS_DIR || fileURLToPath(new URL('../../artifacts/', import.meta.url))) {
  const root = resolve(directory);
  const hash = data => createHash('sha256').update(data).digest('hex');
  function path(key) {
    assert(typeof key === 'string' && /^[a-f0-9-]{36}\.(json|bin)$/.test(key), 'Referência de artefato inválida.', 500);
    const target = resolve(root, key);
    assert(dirname(target) === root, 'Caminho de artefato inválido.', 500);
    return target;
  }
  return {
    async put(data, mediaType = 'application/json') {
      const body = Buffer.isBuffer(data) ? data : Buffer.from(JSON.stringify(data), 'utf8');
      assert(body.length <= 12 * 1024 * 1024, 'Artefato excede 12 MiB.', 413);
      const key = `${randomUUID()}.${mediaType === 'application/json' ? 'json' : 'bin'}`;
      await mkdir(root, { recursive: true, mode: 0o700 });
      await writeFile(path(key), body, { flag: 'wx', mode: 0o600 });
      return { key, sha256: hash(body), byte_size: body.length, media_type: mediaType };
    },
    async read(ref) {
      const body = await readFile(path(ref.key));
      assert(body.length === ref.byte_size && hash(body) === ref.sha256, 'Integridade do artefato comprometida.', 409);
      return body;
    },
    async json(ref) { return JSON.parse((await this.read(ref)).toString('utf8')); },
    async remove(ref) { await unlink(path(ref.key)).catch(error => { if (error.code !== 'ENOENT') throw error; }); },
  };
}
