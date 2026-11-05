import {test,expect} from '@playwright/test';

test('jornada simples cadastra projeto na branch padrão e inicia análise sem configurar agentes',async({page},testInfo)=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/admin/login');await page.getByLabel('E-mail',{exact:true}).fill('researcher@example.test');await page.getByLabel('Senha',{exact:true}).fill('E2E-Research-Only');await page.getByRole('button',{name:'Entrar',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Início',exact:true})).toBeVisible();
  const nav=page.getByRole('navigation',{name:'Navegação principal'});await expect(nav.getByRole('link')).toHaveCount(3);
  await page.screenshot({path:testInfo.outputPath('inicio-desktop.png'),fullPage:true});
  await nav.getByRole('link',{name:'Projetos',exact:true}).click();await page.getByRole('link',{name:'+ Cadastrar projeto',exact:true}).click();
  const name=`Jornada UX ${Date.now()}`;await page.getByLabel('Nome do projeto',{exact:true}).fill(name);await page.getByLabel('Repositório público do GitHub').fill('https://github.com/example/repo');
  await expect(page.getByLabel('Branch, tag ou commit')).not.toBeVisible();await page.getByRole('button',{name:'Salvar projeto',exact:true}).click();await expect(page.getByRole('heading',{name,exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Iniciar análise de requisitos'})).toBeDisabled();await expect(page.getByLabel('Análise de requisitos com ferramentas')).not.toBeVisible();
  await page.getByLabel('Selecionar documento').setInputFiles({name:'jornada.txt',mimeType:'text/plain',buffer:Buffer.from('O sistema deve permitir consultar projetos.')});await page.getByRole('button',{name:'Adicionar documento',exact:true}).click();await expect(page.getByText('jornada.txt · v1 · 1 páginas')).toBeVisible();
  await page.screenshot({path:testInfo.outputPath('preparacao-desktop.png'),fullPage:true});
  const projectId=page.url().split('/').at(-1);await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();await page.screenshot({path:testInfo.outputPath('preparacao-mobile.png'),fullPage:true});
  await page.getByRole('button',{name:'Iniciar análise de requisitos'}).click();await page.waitForURL(/\/admin\/runs\//);const runId=page.url().match(/runs\/([^?]+)/)[1];
  await expect.poll(async()=>{const response=await page.request.get(`http://localhost:3101/api/research/runs/${runId}`);return (await response.json()).data.status;}).toBe('awaiting_review');
  await expect(page.getByRole('heading',{name:'Aguardando sua revisão',exact:true})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();await page.screenshot({path:testInfo.outputPath('resumo-revisao-mobile.png'),fullPage:true});
  const response=await page.request.get(`http://localhost:3101/api/research/runs/${runId}`),run=(await response.json()).data;
  expect(run.workflow_mode).toBe('assisted/v1');expect(run.snapshot_data.code_version.requested_ref).toBe('main');expect(run.snapshot_data.agent_policy.modes.requirements).toBe('fixed/v1');expect(run.snapshot_data.agent_policy.modes.automation).toBe('agent/v1');expect(run.execution_jobs).toEqual([]);
  await page.goto(`/admin/projects/${projectId}`);await expect(page.getByRole('button',{name:'Iniciar análise de requisitos'})).toBeDisabled();await expect(page.getByRole('link',{name:'Abrir análise',exact:true})).toBeVisible();
  for(const path of ['requirements','test-cases','analysis','reports']){await page.goto(`/admin/${path}`);await expect(page.getByRole('heading',{level:1})).toBeVisible();}
  expect(errors).toEqual([]);
});
