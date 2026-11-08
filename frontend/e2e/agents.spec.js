import {test,expect} from '@playwright/test';

test('A2 consulta A1 e o pesquisador revisa a resposta antes dos casos',async({page})=>{
  const post=async(path,data)=>{const r=await page.request.post('http://localhost:3101/api'+path,{data,headers:{Origin:'http://localhost:5178'}});expect(r.ok()).toBeTruthy();return (await r.json()).data;};
  await post('/auth/admin/login',{email:'researcher@example.test',password:'E2E-Research-Only'});
  const project=await post('/research/projects',{name:`Colaboração E2E ${Date.now()}`,repository_url:'https://github.com/example/repo',requested_ref:'main',complementary_text:'O sistema deve permitir consultar projetos.'});
  await page.goto(`/admin/projects/${project.id}`);await page.getByText('Configurações avançadas da análise',{exact:true}).click();await page.getByLabel('Geração de casos com ferramentas',{exact:true}).check();await page.getByRole('button',{name:'Iniciar análise de requisitos'}).click();
  await page.getByRole('button',{name:'Revisar agora',exact:true}).click();await expect(page.getByRole('heading',{name:'Colaboração E2E: consulta',exact:true})).toBeVisible({timeout:20000});await page.getByRole('button',{name:'Aprovar todos e gerar casos de teste'}).click();
  await expect(page.getByRole('heading',{name:'Mensagens entre agentes',exact:true})).toBeVisible({timeout:20000});
  await expect(page.getByRole('button',{name:'Reconhecer esclarecimento',exact:true})).toBeVisible({timeout:20000});
  await expect(page.getByRole('button',{name:'Aprovar todos e continuar'})).toBeDisabled();
  await page.getByLabel('Justificativa da revisão do esclarecimento',{exact:true}).fill('Fonte conferida no controle E2E, sem julgamento científico.');
  await page.getByRole('button',{name:'Reconhecer esclarecimento',exact:true}).click();await expect(page.getByText('Esclarecimento reconhecido',{exact:false})).toBeVisible();
  await expect(page.getByRole('button',{name:'Aprovar todos e continuar'})).toBeEnabled();
  await page.getByRole('link',{name:'Configuração e registros',exact:true}).click();await expect(page.getByRole('heading',{name:/A1.*Análise de requisitos/})).toBeVisible();
});

test('A2 textual consulta os requisitos e apresenta casos sujeitos à revisão',async({page})=>{
  const post=async(path,data)=>{const r=await page.request.post('http://localhost:3101/api'+path,{data,headers:{Origin:'http://localhost:5178'}});expect(r.ok()).toBeTruthy();return (await r.json()).data;};
  await post('/auth/admin/login',{email:'researcher@example.test',password:'E2E-Research-Only'});
  const project=await post('/research/projects',{name:`A2 textual E2E ${Date.now()}`,repository_url:'https://github.com/example/repo',requested_ref:'main',complementary_text:'O sistema deve permitir consultar projetos.'});
  await page.goto(`/admin/projects/${project.id}`);
  await page.getByText('Configurações avançadas da análise',{exact:true}).click();await page.getByLabel('Geração de casos com ferramentas',{exact:true}).check();
  await page.getByRole('button',{name:'Iniciar análise de requisitos'}).click();
  await page.getByRole('button',{name:'Revisar agora',exact:true}).click();await expect(page.getByRole('heading',{name:'Consulta de projetos',exact:true})).toBeVisible({timeout:20000});
  await page.getByRole('button',{name:'Aprovar todos e gerar casos de teste'}).click();
  await expect(page.getByRole('heading',{name:'Cenário para RF-001',exact:true})).toBeVisible({timeout:20000});
  await page.getByRole('link',{name:'Configuração e registros',exact:true}).click();
  await page.getByRole('button',{name:'Consultar sessão',exact:true}).click();
  await expect(page.getByText('Consultar requisito para os casos',{exact:true})).toBeVisible();
});

test('A1 consulta documentos e apresenta sua trajetória e citações para revisão',async({page})=>{
  const post=async(path,data)=>{const r=await page.request.post('http://localhost:3101/api'+path,{data,headers:{Origin:'http://localhost:5178'}});expect(r.ok()).toBeTruthy();return (await r.json()).data;};
  await post('/auth/admin/login',{email:'researcher@example.test',password:'E2E-Research-Only'});
  const project=await post('/research/projects',{name:`A1 E2E ${Date.now()}`,repository_url:'https://github.com/example/repo',requested_ref:'main',complementary_text:'O sistema deve permitir consultar projetos.'});
  await page.goto(`/admin/projects/${project.id}`);
  await page.getByText('Configurações avançadas da análise',{exact:true}).click();await page.getByLabel('Análise de requisitos com ferramentas',{exact:true}).check();
  await page.getByRole('button',{name:'Iniciar análise de requisitos'}).click();
  await page.waitForURL(/\/admin\/runs\//);
  await page.getByRole('link',{name:'Configuração e registros',exact:true}).click();
  await expect(page.locator('.heading-actions .status-awaiting_review')).toBeVisible({timeout:20000});
  await page.getByRole('button',{name:'Consultar sessão',exact:true}).click();
  await expect(page.getByRole('heading',{name:/A1.*Análise de requisitos/})).toBeVisible();
  await expect(page.getByText('Consultar trechos dos documentos',{exact:true})).toBeVisible();
  await page.getByRole('link',{name:'Requisitos',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Consulta de projetos',exact:true})).toBeVisible();
});

for(const variant of ['budget','cancel'])test(`trajetória do agente registra ${variant==='budget'?'limite atingido':'cancelamento'} sem afirmar execução`,async({page},testInfo)=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const post=async(path,data)=>{
    const response=await page.request.post('http://localhost:3101/api'+path,{data,headers:{Origin:'http://localhost:5178'}});
    expect(response.ok()).toBeTruthy();return (await response.json()).data;
  };
  await post('/auth/admin/login',{email:'researcher@example.test',password:'E2E-Research-Only'});
  const project=await post('/research/projects',{name:`${variant==='cancel'?'Cancelar agente E2E':'Orçamento agente E2E'} ${Date.now()}`,repository_url:'https://github.com/example/repo',requested_ref:'main',complementary_text:'O sistema deve permitir consultar projetos.'});
  const run=await post(`/research/projects/${project.id}/runs`,{agent_policy:{modes:{automation:'agent/v1'},...(variant==='budget'?{limits:{max_model_turns:1}}:{})}});
  const detail=async()=>{const response=await page.request.get(`http://localhost:3101/api/research/runs/${run.id}`);return (await response.json()).data;};
  await expect.poll(async()=>(await detail()).status,{timeout:20000}).toBe('awaiting_review');let current=await detail();
  await post(`/research/runs/${run.id}/approve/requirements`,{approve_pending:true,items:current.requirements.map(({id,revision})=>({id,revision})),justification:'Revisão técnica E2E.'});
  await expect.poll(async()=>(await detail()).test_cases.length,{timeout:20000}).toBe(1);current=await detail();
  await post(`/research/runs/${run.id}/approve/tests`,{approve_pending:true,items:current.test_cases.map(({id,revision})=>({id,revision})),justification:'Casos da fixture.'});
  const inspection=await post(`/research/projects/${project.id}/versions/${run.code_version_id}/inspect`,{});
  await post(`/research/runs/${run.id}/automation`,{inspection_id:inspection.inspection_id,module_root:'',justification:'Controle de limite/cancelamento.'});
  if(variant==='budget')await expect.poll(async()=>(await detail()).status,{timeout:20000}).toBe('failed');
  else await expect.poll(async()=>(await detail()).agent_summary.sessions,{timeout:20000}).toBe(1);
  await page.goto(`/admin/runs/${run.id}?view=history`);
  await expect(page.getByRole('heading',{name:'Trajetória do agente'})).toBeVisible();
  if(variant==='cancel') {
    await page.getByText('Retomar ou encerrar análise',{exact:true}).click();await page.getByLabel('Motivo do encerramento').selectOption({label:'Encerrar uma análise de controle'});
    await page.getByRole('button',{name:'Cancelar execução',exact:true}).click();
    await expect(page.locator('.heading-actions .status-cancelled')).toBeVisible();
  }
  await page.getByRole('button',{name:'Consultar sessão',exact:true}).click();
  await expect(page.getByText(variant==='budget'?'Orçamento da tarefa esgotado':'Cancelada pelo pesquisador',{exact:true})).toBeVisible();
  current=await detail();expect(current.automated_tests).toEqual([]);expect(current.execution_jobs).toEqual([]);
  await page.getByRole('link',{name:'Agentes e histórico',exact:true}).click();
  await expect(page.getByText('Histórico preservado',{exact:true})).toBeVisible();
  await expect(page.locator('.timeline-event').filter({hasText:variant==='cancel'?'Execução cancelada':'Tarefa falhou'})).toBeVisible();
  await page.setViewportSize({width:390,height:844});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBeTruthy();
  await page.screenshot({path:testInfo.outputPath(`agent-${variant}-mobile.png`),fullPage:true});
  expect(errors).toEqual([]);
});
