// Processo exclusivo de extração. Nunca recebe o ambiente/credenciais do backend.
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

const chunks = [];
let bytes = 0;
for await (const chunk of process.stdin) {
  bytes += chunk.length;
  if (bytes > 10485760) throw new Error('PDF excede 10 MiB.');
  chunks.push(chunk);
}
const task = getDocument({ data: new Uint8Array(Buffer.concat(chunks)), isEvalSupported: false,
  disableFontFace: true, useSystemFonts: false, verbosity: 0, stopAtErrors: true,
  isOffscreenCanvasSupported: false, useWorkerFetch: false });
try {
  const pdf = await task.promise;
  if (pdf.numPages > 200) throw new Error('PDF excede 200 páginas.');
  const pages = [];
  let chars = 0;
  for (let page = 1; page <= pdf.numPages; page++) {
    const documentPage = await pdf.getPage(page);
    const content = await documentPage.getTextContent();
    const text = content.items.map(item => `${item.str || ''}${item.hasEOL ? '\n' : ' '}`).join('').trim();
    chars += text.length;
    if (chars > 200000) throw new Error('Texto extraído excede 200 mil caracteres.');
    pages.push({ page, text });
    documentPage.cleanup();
  }
  // Prefixo para separar JSON de eventuais avisos da biblioteca.
  process.stdout.write(`\nTCC_RESULT:${JSON.stringify({ pages })}`);
} finally { await task.destroy(); }
