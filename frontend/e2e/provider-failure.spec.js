import {test,expect} from '@playwright/test';
test('mapa localiza falha 503 no A1 e mantém os outros agentes não iniciados',async({page},testInfo)=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const post=async(path,data)=>{const response=await page.request.post(`http://localhost:3101/api${path}`,{data,headers:{Origin:'http://localhost:5178'}});expect(response.ok(),await response.text()).toBeTruthy();return (await response.json()).data;};
  await post('/auth/admin/login',{email:'researcher@example.test',password:'E2E-Research-Only'});
  const project=await post('/research/projects',{name:'Falha do provedor 503',repository_url:'https://github.com/example/repo',requested_ref:'main'});
  const upload=await page.request.post(`http://localhost:3101/api/research/projects/${project.id}/documents`,{data:Buffer.from('O sistema deve permitir consultar projetos.'),headers:{Origin:'http://localhost:5178','Content-Type':'text/plain','X-File-Name':'503-E2E.txt'}});expect(upload.ok()).toBeTruthy();
  const run=await post(`/research/projects/${project.id}/runs`,{agent_policy:{version:'1.0.0',modes:{requirements:'agent/v1'}}});await page.goto(`/admin/runs/${run.id}?view=timeline`);
  await expect(page.getByRole('heading',{name:'O serviço do modelo está indisponível',exact:true})).toBeVisible({timeout:20000});await expect(page.locator('.map-node.state-failed')).toHaveCount(1);await expect(page.locator('.map-node.state-idle')).toHaveCount(3);await expect(page.locator('.map-node.is-live')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Retomar etapa',exact:true})).toBeVisible();await page.screenshot({path:testInfo.outputPath('mapa-falha-503-desktop.png'),fullPage:true});
  await page.getByRole('button',{name:'Ver falha',exact:true}).click();const dialog=page.getByRole('dialog');await expect(dialog).toContainText('HTTP 503');await expect(dialog.getByText('Conteúdo preservado completo',{exact:true})).toBeVisible();await expect(dialog.locator('.code-panel')).not.toBeVisible();await page.keyboard.press('Escape');await expect(dialog).not.toBeVisible();await expect(page.getByRole('button',{name:'Ver falha',exact:true})).toBeFocused();
  const response=await page.request.get(`http://localhost:3101/api/research/runs/${run.id}`),detail=(await response.json()).data;expect(detail.attempts).toHaveLength(1);expect(detail.agent_summary.model_turns).toBe(1);expect(detail.execution_jobs).toEqual([]);expect(errors).toEqual([]);
  await page.setViewportSize({width:390,height:844});await expect(page.locator('.map-compact')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBeTruthy();expect(await page.locator('.map-node').evaluateAll(nodes=>nodes.every(node=>{const box=node.getBoundingClientRect();return box.left>=0&&box.right<=window.innerWidth;}))).toBeTruthy();await page.screenshot({path:testInfo.outputPath('mapa-falha-503-mobile.png'),fullPage:true});
});

test('nova política recupera dois 503 e preserva reenvios sem repetir a etapa',async({page})=>{
  const post=async(path,data)=>{const r=await page.request.post(`http://localhost:3101/api${path}`,{data,headers:{Origin:'http://localhost:5178'}});expect(r.ok(),await r.text()).toBeTruthy();return (await r.json()).data;};
  await post('/auth/admin/login',{email:'researcher@example.test',password:'E2E-Research-Only'});
  const p=await post('/research/projects',{name:'Retentativas E2E',repository_url:'https://github.com/example/repo',requested_ref:'main'});
  const upload=await page.request.post(`http://localhost:3101/api/research/projects/${p.id}/documents`,{data:Buffer.from('O sistema deve permitir consultar projetos.'),headers:{Origin:'http://localhost:5178','Content-Type':'text/plain','X-File-Name':'Retry-E2E.txt'}});expect(upload.ok()).toBeTruthy();
  const run=await post(`/research/projects/${p.id}/runs`,{agent_policy:{modes:{requirements:'agent/v1'},model_retry:{initial_delay_ms:500,max_delay_ms:1000}}});await page.goto(`/admin/runs/${run.id}?view=timeline`);
  await expect(page.locator('.timeline-event').filter({hasText:'Aguardando nova tentativa do modelo'})).toHaveCount(2,{timeout:10000});
  const detail=async()=>{const r=await page.request.get(`http://localhost:3101/api/research/runs/${run.id}`);return (await r.json()).data;};await expect.poll(async()=>(await detail()).status).toBe('awaiting_review');
  const current=await detail();expect(current.attempts).toHaveLength(1);expect(current.agent_summary.model_turns).toBe(5);expect(current.agent_summary.usage_unknown).toBeTruthy();expect(current.execution_jobs).toEqual([]);
  const history=await page.request.get(`http://localhost:3101/api/research/runs/${run.id}/export/json`),exported=await history.json();expect(exported.timeline_summary.model_retries).toBe(2);expect(exported.timeline_summary.technical_retries).toBe(0);expect(exported.run_events.filter(e=>e.kind==='model_turn_failed')).toHaveLength(2);
});
