import {test,expect} from '@playwright/test';
test('A3 pede revisão ao A2 e o pesquisador inspeciona rascunho sem substituir script aprovado',async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  const post=async(path,data)=>{const response=await page.request.post('http://localhost:3101/api'+path,{data,headers:{Origin:'http://localhost:5178'}});expect(response.ok()).toBeTruthy();return (await response.json()).data;};
  await post('/auth/admin/login',{email:'researcher@example.test',password:'E2E-Research-Only'});
  await page.request.post('http://localhost:3101/__e2e/enable-executor',{data:{enabled:true}});
  try {
    const project=await post('/research/projects',{name:`Revisão A3 E2E ${Date.now()}`,repository_url:'https://github.com/example/repo',requested_ref:'main',complementary_text:'O sistema deve permitir consultar projetos.'});
    const run=await post(`/research/projects/${project.id}/runs`,{agent_policy:{modes:{execution:'agent/v1'}}});
    const detail=async()=>{const r=await page.request.get(`http://localhost:3101/api/research/runs/${run.id}`);return (await r.json()).data;};
    await expect.poll(async()=>(await detail()).requirements.length).toBe(1);let current=await detail();
    await post(`/research/runs/${run.id}/approve/requirements`,{approve_pending:true,items:current.requirements.map(({id,revision})=>({id,revision})),justification:'Requisitos de controle.'});
    await expect.poll(async()=>(await detail()).test_cases.length).toBe(1);current=await detail();
    await post(`/research/runs/${run.id}/approve/tests`,{approve_pending:true,items:current.test_cases.map(({id,revision})=>({id,revision})),justification:'Casos de controle.'});
    const inspection=await post(`/research/projects/${project.id}/versions/${run.code_version_id}/inspect`,{});await post(`/research/runs/${run.id}/automation`,{inspection_id:inspection.inspection_id,module_root:'',justification:'Fixture de geração.'});
    await expect.poll(async()=>(await detail()).automated_tests.length).toBe(1);current=await detail();await post(`/research/runs/${run.id}/automation/approve`,{approve_pending:true,items:current.automated_tests.map(({id,revision})=>({id,revision})),justification:'Aprovar fixture de script.'});
    await post(`/research/runs/${run.id}/execution/planning`,{justification:'Planejamento de controle.'});await expect.poll(async()=>(await detail()).execution_proposals.length).toBe(1);current=await detail();
    await post(`/research/runs/${run.id}/execution`,{proposal_id:current.execution_proposals[0].id,justification:'Executor simulado, sem ensaio científico.'});
    await expect.poll(async()=>(await detail()).findings.length,{timeout:20000}).toBe(1);await page.goto(`/admin/runs/${run.id}?view=analysis`);
    await expect(page.getByRole('heading',{name:'A3 → A2 · CT-001',exact:true})).toBeVisible();await page.getByText('Rascunho da versão 2 · não aplicado',{exact:true}).click();
    await expect(page.getByText('Esperado preservado:',{exact:false})).toBeVisible();
    await page.getByLabel('Justificativa da revisão da proposta de script',{exact:true}).fill('Rascunho inspecionado, preservado sem aplicação no controle E2E.');await page.getByRole('button',{name:'Reconhecer proposta sem aplicar',exact:true}).click();
    await expect.poll(async()=>(await detail()).agent_messages[0].review_status).toBe('acknowledged');current=await detail();expect(current.automated_tests[0].version).toBe(1);expect(current.evidence).toHaveLength(1);expect(current.execution_jobs).toHaveLength(1);
    await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBeTruthy();expect(errors).toEqual([]);
  }finally{await page.request.post('http://localhost:3101/__e2e/enable-executor',{data:{enabled:false}});}
});
