import { Router, raw } from 'express';
import rateLimit from 'express-rate-limit';
import { requireAdmin } from '../middlewares/auth.js';
import { assert, uuid } from './errors.js';

export function createResearchRouter({ projects, store }) {
  const router = Router();
  router.use(requireAdmin);
  router.use((request, _response, next) => {
    if (!['GET','HEAD','OPTIONS'].includes(request.method)) {
      const origin = request.get('origin');
      const expected = process.env.FRONTEND_URL || 'http://localhost:5173';
      assert((!origin || origin === expected) && request.get('sec-fetch-site') !== 'cross-site', 'Origem não autorizada.', 403);
    }
    next();
  });
  router.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, message: { error: 'Limite de requisições atingido. Tente mais tarde.' } }));
  const imports = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, message: { error: 'Limite de importações atingido. Tente mais tarde.' } });
  const handler = action => async (request, response) => response.json({ data: await action(request, response) });
  router.param('projectId', (_request, _response, next, value) => { uuid(value); next(); });
  router.param('documentId', (_request, _response, next, value) => { uuid(value); next(); });
  router.get('/projects', handler(() => projects.list()));
  router.post('/projects', imports, async (req, res) => res.status(201).json({ data: await projects.create(req.body) }));
  router.get('/projects/:projectId', handler(req => projects.detail(req.params.projectId)));
  router.put('/projects/:projectId', imports, handler(req => projects.update(req.params.projectId, req.body)));
  router.post('/projects/:projectId/documents', imports,
    raw({ type: ['application/pdf','text/plain','text/markdown','application/octet-stream'], limit: '10mb', inflate: false }),
    async (req, res) => {
      let filename;
      try { filename = decodeURIComponent(req.get('x-file-name') || ''); } catch { assert(false, 'Nome de arquivo inválido.'); }
      res.status(201).json({ data: await projects.addDocument(req.params.projectId, req.body, filename, req.get('content-type')?.split(';')[0]) });
    });
  router.get('/projects/:projectId/documents/:documentId', handler(req => projects.document(req.params.projectId,req.params.documentId)));
  router.get('/projects/:projectId/documents/:documentId/download', async (req,res) => {
    const doc = await projects.document(req.params.projectId,req.params.documentId);
    res.set('Content-Type', doc.media_type).set('X-Content-Type-Options','nosniff');
    res.attachment(doc.name).send(await store.read(doc.artifact));
  });
  return router;
}
