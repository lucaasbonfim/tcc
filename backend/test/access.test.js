import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import { createResearchRouter } from '../src/research/routes.js';
import { errorHandler } from '../src/middlewares/errorHandler.js';

test('API protege projetos e impede escrita cross-site', async () => {
  const secret = process.env.AUTH_SECRET || 'test-secret-for-authentication-only';
  process.env.AUTH_SECRET = secret;
  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use('/research',createResearchRouter({ projects:{ list: async () => [] } }));
  app.use(errorHandler);
  const server = app.listen(0,'127.0.0.1');
  await new Promise(resolve => server.once('listening',resolve));
  const url = `http://127.0.0.1:${server.address().port}/research`;
  try {
    assert.equal((await fetch(`${url}/projects`)).status,401);
    const participant = `tcc_session=${jwt.sign({role:'participant',participantId:1},secret)}`;
    assert.equal((await fetch(`${url}/projects`,{headers:{Cookie:participant}})).status,401);
    const admin = `tcc_session=${jwt.sign({role:'admin'},secret)}`;
    assert.equal((await fetch(`${url}/projects`,{headers:{Cookie:admin}})).status,200);
    assert.equal((await fetch(`${url}/projects`,{method:'POST',headers:{Cookie:admin,Origin:'https://evil.example'}})).status,403);
    assert.equal((await fetch(`${url}/projects/invalid`,{headers:{Cookie:admin}})).status,400);
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});
