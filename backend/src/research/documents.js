import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { assert, fail, text } from './errors.js';
let activePdfParsers = 0;

export async function extractDocument(buffer, filename, mediaType) {
  assert(Buffer.isBuffer(buffer) && buffer.length > 0 && buffer.length <= 10485760, 'Documento vazio ou maior que 10 MiB.', 413);
  const name = text(filename, 'Nome do documento', 180, true);
  assert(!/[\x00-\x1f\\/]/.test(name), 'Nome de arquivo inválido.');
  const extension = name.split('.').pop().toLowerCase();
  let pages;
  const warnings = [];
  if (extension === 'pdf') {
    assert(mediaType === 'application/pdf' && buffer.subarray(0,5).toString() === '%PDF-', 'PDF inválido ou tipo incompatível.');
    assert(activePdfParsers < 2, 'Extração ocupada. Aguarde e tente novamente.',503);
    activePdfParsers++;
    try { pages = await new Promise((resolve, reject) => {
      const child = execFile(process.execPath, ['--max-old-space-size=128', fileURLToPath(new URL('./pdf-parser.js', import.meta.url))],
        { timeout: 15000, maxBuffer: 1200000, windowsHide: true,
          env: { SystemRoot: process.env.SystemRoot, PATH: '' } }, (error, stdout) => {
          if (error) return reject(Object.assign(new Error('PDF não pôde ser extraído. Verifique proteção por senha, integridade, limite de páginas ou tempo.'), { statusCode: 422 }));
          try { resolve(JSON.parse(stdout.split('TCC_RESULT:').pop()).pages); }
          catch { reject(Object.assign(new Error('Resposta inválida na extração PDF.'), { statusCode: 422 })); }
        });
      child.stdin.on('error', () => {});
      child.stdin.end(buffer);
    }); } finally { activePdfParsers--; }
    warnings.push('Somente camada textual extraída. Diagramas, imagens e ordem de leitura precisam de conferência humana; OCR não disponível.');
    const empty = pages.filter(page => page.text.trim().length < 20).map(page => page.page);
    if (empty.length) warnings.push(`Páginas com pouco ou nenhum texto: ${empty.join(', ')}. Extração possivelmente incompleta.`);
    if (pages.every(page => !page.text.trim())) warnings.push('Documento sem camada textual utilizável. Adicione uma transcrição antes da análise.');
  } else if (['txt','md'].includes(extension)) {
    assert(['text/plain','text/markdown','application/octet-stream'].includes(mediaType), 'Tipo de texto incompatível.');
    let content;
    try { content = new TextDecoder('utf-8', { fatal: true }).decode(buffer); } catch { fail(422, 'Use texto codificado em UTF-8.'); }
    assert(!content.includes('\0') && content.length <= 200000, 'Texto inválido ou maior que 200 mil caracteres.');
    pages = [{ page: 1, text: content }];
  } else fail(400, 'Formatos aceitos: PDF, TXT ou MD.');
  return { name, media_type: extension === 'pdf' ? 'application/pdf' : 'text/plain', pages, warnings };
}
