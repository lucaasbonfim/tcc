import {test,expect} from '@playwright/test';
test('autonomia mostra consulta ao vivo, preserva artefatos e recebe julgamento somente ao final',async({page},testInfo)=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  const post=async(path,data={})=>{const response=await page.request.post(`http://localhost:3101${path}`,{data,headers:{Origin:'http://localhost:5178'}});expect(response.ok(),await response.text()).toBeTruthy();return response.json();};
  await post('/api/auth/admin/login',{email:'researcher@example.test',password:'E2E-Research-Only'});
  await post('/__e2e/enable-executor');
  try{
    const {data:project}=await post('/api/research/projects',{name:`Autonomia E2E ${Date.now()}`,repository_url:'https://github.com/example/repo',requested_ref:'main'});
    await page.goto(`/admin/projects/${project.id}`);
    await page.getByLabel('Selecionar documento').setInputFiles({name:'Autonomia E2E.txt',mimeType:'text/plain',buffer:Buffer.from('O sistema deve permitir consultar projetos.')});await page.getByRole('button',{name:'Adicionar documento',exact:true}).click();await expect(page.getByText('Autonomia E2E.txt · v1 · 1 páginas')).toBeVisible();
    await page.getByLabel('Modo de trabalho',{exact:true}).selectOption('autonomous/v1');
    for(const label of ['Análise de requisitos com ferramentas','Geração de casos com ferramentas','Avaliação de evidências com ferramentas','Planejamento de execução com ferramentas'])await expect(page.getByLabel(label,{exact:true})).toBeChecked();
    const start=page.getByRole('button',{name:'Iniciar execução autônoma'});await expect(start).toBeDisabled();
    await page.getByRole('button',{name:'Inspecionar escopo para autonomia'}).click();await expect(page.getByLabel('Módulo autorizado')).toBeVisible();
    await page.getByLabel('Justificativa da autorização inicial').fill('Fixture de autonomia, sem execução real de código.');
    await expect(start).toBeDisabled();await page.getByRole('checkbox',{name:'Autorizo os agentes a gerar e executar testes'}).check();await start.click();
    await expect(page.getByRole('heading',{name:'Trajetória dos agentes',exact:true})).toBeVisible();
    const requestEvent=page.locator('.timeline-event').filter({hasText:'Pedido entre agentes'}).filter({hasText:'A2 · Testes → A1 · Requisitos'});await expect(requestEvent).toBeVisible({timeout:25000});
    await expect(page.getByText('Aguardando resposta',{exact:true})).toBeVisible();await requestEvent.click();await expect(page.locator('.timeline-detail')).toContainText('As fontes especificam o tratamento de entradas inválidas?');
    await page.screenshot({path:testInfo.outputPath('agentes-consulta-ao-vivo.png'),fullPage:true});
    await expect(page.getByText('Histórico preservado',{exact:true})).toBeVisible({timeout:25000});await expect(page.locator('.heading-actions .status-completed')).toBeVisible();
    await expect(page.getByRole('button',{name:/Aprovar todos/})).toHaveCount(0);
    await page.getByLabel('Exibir eventos').selectOption('messages');await expect(page.locator('.timeline-event')).toHaveCount(2);expect(await page.locator('[data-event-id]').evaluateAll(nodes=>new Set(nodes.map(n=>n.dataset.eventId)).size===nodes.length)).toBeTruthy();
    const responseEvent=page.locator('.timeline-event').filter({hasText:'Resposta entre agentes'});await responseEvent.click();await expect(page.locator('.timeline-detail')).toContainText('As fontes não especificam');
    await page.getByRole('button',{name:'Atualizar histórico',exact:true}).click();await expect(page.locator('.timeline-event')).toHaveCount(2);
    await page.getByLabel('Exibir eventos').selectOption('artifacts');await page.getByLabel('Agente',{exact:true}).selectOption('tests');
    const artifact=page.locator('.timeline-event').filter({hasText:'Saída preservada'}).filter({hasText:'A2 · Scripts'});await artifact.click();await expect(page.locator('.timeline-detail')).toContainText('Versão 1 · revisão 0');await expect(page.locator('.timeline-detail')).toContainText('consultarProjetos');
    const panel=page.locator('.timeline-detail');await panel.getByLabel('Julgamento',{exact:true}).selectOption('partial');await panel.getByLabel('Justificativa do julgamento').fill('Julgamento da fixture sobre a versão preservada, sem alterar o script.');await panel.getByLabel('Referência consultada (opcional)').fill('Controle E2E; sem referência científica.');await panel.getByRole('button',{name:'Registrar julgamento posterior'}).click();await expect(panel.getByText('Julgamento da fixture sobre a versão preservada, sem alterar o script.',{exact:true})).toBeVisible();
    const runId=page.url().match(/runs\/([^?]+)/)[1],response=await page.request.get(`http://localhost:3101/api/research/runs/${runId}/export/json`),history=await response.json();expect(history.workflow_mode).toBe('autonomous/v1');expect(history.reviews).toEqual([]);expect(history.experiment_assessments).toHaveLength(1);expect(history.automated_tests[0].version).toBe(1);expect(history.automated_tests[0].review_status).toBe('pending');expect(history.timeline_summary.completed_cycles).toBe(1);expect(history.timeline_summary.technical_retries).toBe(0);
    await page.reload();await expect(page.getByRole('heading',{name:'Trajetória dos agentes',exact:true})).toBeVisible();await page.getByLabel('Exibir eventos').selectOption('human');await expect(page.locator('.timeline-event').filter({hasText:'Julgamento posterior'})).toHaveCount(1);
    await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBeTruthy();await page.screenshot({path:testInfo.outputPath('agentes-historico-mobile.png'),fullPage:true});expect(errors).toEqual([]);
  }finally{await page.request.post('http://localhost:3101/__e2e/enable-executor',{data:{enabled:false},timeout:5000}).catch(()=>{});}
});
