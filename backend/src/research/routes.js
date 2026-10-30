import { Router, raw } from 'express';
import rateLimit from 'express-rate-limit';
import { requireAdmin } from '../middlewares/auth.js';
import { assert, uuid } from './errors.js';
import { exportCsv } from './export.js';
import { trustedOrigin } from '../middlewares/trustedOrigin.js';

export function createResearchRouter({ projects, store, runs, automation,execution }) {
  const router = Router();
  router.use(requireAdmin);
  router.use(trustedOrigin);
  router.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, message: { error: 'Limite de requisições atingido. Tente mais tarde.' } }));
  const imports = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, message: { error: 'Limite de importações atingido. Tente mais tarde.' } });
  const handler = action => async (request, response) => response.json({ data: await action(request, response) });
  router.param('projectId', (_request, _response, next, value) => { uuid(value); next(); });
  router.param('documentId', (_request, _response, next, value) => { uuid(value); next(); });
  for (const name of ['runId','itemId','attemptId','versionId']) router.param(name, (_req,_res,next,value) => { uuid(value); next(); });
  router.use((req,_res,next) => {
    if (['POST','PUT'].includes(req.method) && !req.path.endsWith('/documents')) {
      assert(req.body && typeof req.body === 'object' && !Array.isArray(req.body),'Envie um objeto JSON.');
    }
    next();
  });
  router.get('/capabilities',handler(async() => ({
    requirements:{enabled:Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_MODEL),requires_worker:true},
    tests:{enabled:Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_MODEL),artifact_types:['textual','automated'],requires_review:true,adapters:['node-test/v2','java-junit/v1']},
    execution:execution ? await execution.capabilities() : {ready:false,reason:'Executor não configurado.'},
    evaluation:{enabled:false,reason:'Depende de evidências independentes de execução, indisponíveis nesta versão.'},
  })));
  router.get('/projects', handler(() => projects.list()));
  router.get('/summary',handler(() => runs.summary()));
  router.post('/projects', imports, async (req, res) => res.status(201).json({ data: await projects.create(req.body) }));
  router.get('/projects/:projectId', handler(req => projects.detail(req.params.projectId)));
  router.put('/projects/:projectId', imports, handler(req => projects.update(req.params.projectId, req.body)));
  router.post('/projects/:projectId/versions/:versionId/inspect',imports,handler(req => projects.inspect(req.params.projectId,req.params.versionId)));
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
  router.post('/projects/:projectId/runs', imports, async (req,res) => res.status(202).json({data:await runs.create(req.params.projectId,req.body)}));
  router.get('/runs', handler(() => runs.list()));
  router.get('/runs/:runId', handler(req => runs.detail(req.params.runId)));
  router.post('/runs/:runId/automation',imports,async(req,res)=>res.status(202).json({data:await automation.start(req.params.runId,req.body)}));
  router.get('/runs/:runId/automated-tests',handler(req=>automation.list(req.params.runId)));
  router.post('/runs/:runId/automated-tests/:itemId/review',handler(req=>automation.review(req.params.runId,req.params.itemId,req.body)));
  router.post('/runs/:runId/automation/approve',handler(req=>automation.approve(req.params.runId,req.body)));
  router.post('/runs/:runId/execution',imports,async(req,res)=>res.status(202).json({data:await execution.authorize(req.params.runId,req.body)}));
  router.post('/runs/:runId/reviews/:kind/:itemId', handler(req => runs.reviewItem(req.params.runId,req.params.kind,req.params.itemId,req.body)));
  router.post('/runs/:runId/approve/:agent', handler(req => runs.approveStage(req.params.runId,req.params.agent,req.body)));
  router.post('/runs/:runId/retry', imports, handler(req => runs.retry(req.params.runId,req.body)));
  router.post('/runs/:runId/cancel', handler(async req => {const result=await runs.cancel(req.params.runId,req.body);await execution?.cancel(req.params.runId);return result;}));
  router.get('/runs/:runId/attempts/:attemptId/:type', handler(req => runs.artifact(req.params.runId,req.params.attemptId,req.params.type)));
  router.get('/runs/:runId/export/:format',async (req,res) => {
    assert(['json','csv'].includes(req.params.format),'Formato de exportação inválido.');
    const data = await runs.export(req.params.runId);
    res.attachment(`research-${req.params.runId}.${req.params.format}`);
    if (req.params.format === 'csv') res.type('text/csv').send(exportCsv(data));
    else res.json(data);
  });
  return router;
}
