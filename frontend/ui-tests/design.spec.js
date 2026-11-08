import {test,expect} from '@playwright/test';

function fixture() {
  const requirements=[1,2].map(n=>({id:`req-${n}`,code:`RF-00${n}`,revision:1,review_status:'pending',content:{title:`Consultar projeto ${n}`,description:'O pesquisador deve consultar os projetos e suas evidências.',kind:'functional',sources:[{document_id:'doc',page:n,quote:`O sistema deve permitir consultar o projeto ${n}.`}]}}));
  return {id:'demo',project_id:'project',status:'awaiting_review',workflow_mode:'assisted/v1',created_at:'2026-11-08T12:00:00Z',snapshot_data:{project:{name:'Análise de requisitos do catálogo'},documents:[{id:'doc',name:'Requisitos do catálogo',version:1}],code_version:{commit_sha:'a'.repeat(40)},agent_policy:{modes:{}}},requirements,test_cases:[],stages:[{id:'stage',agent:'requirements',status:'awaiting_review'}],agent_messages:[],attempts:[],reviews:[],automated_tests:[],execution_jobs:[],evidence:[],findings:[]};
}

test.beforeEach(async({page})=>{
  const run=fixture();
  await page.route('**/api/**',async route=>{
    const path=new URL(route.request().url()).pathname;
    const data=path.endsWith('/auth/me')?{role:'admin'}:path.endsWith('/runs/demo')?run:path.endsWith('/assessments')?[]:path.endsWith('/summary')?{projects:1,runs:1}:path.endsWith('/projects')?[]:path.endsWith('/runs')?[]:{};
    await route.fulfill({json:{data}});
  });
});

test('navegação mantém destinos e troca de etapa em telas pequenas',async({page},testInfo)=>{
  await page.goto('/admin/runs/demo');
  const nav=page.getByRole('navigation',{name:'Resultados da execução'});
  await expect(nav.getByRole('link')).toHaveCount(6);
  await nav.getByRole('link',{name:'Requisitos',exact:true}).click();
  await expect(page).toHaveURL(/view=requirements/);
  await expect(page.getByRole('status')).toContainText('2 itens aguardam');
  await expect(nav.getByRole('link',{name:'Requisitos',exact:true})).toHaveAttribute('aria-current','page');
  await page.screenshot({path:testInfo.outputPath('revisao-desktop.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await page.getByLabel('Etapa da análise',{exact:true}).selectOption('overview');
  await expect(page.getByRole('heading',{name:'Aguardando sua revisão',exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
  await page.screenshot({path:testInfo.outputPath('resumo-mobile.png'),fullPage:true});
});

test('revisão vincula a fonte ao item e protege edições ao trocar de requisito',async({page},testInfo)=>{
  await page.goto('/admin/runs/demo?view=requirements');
  const sources=page.getByRole('complementary',{name:'Fontes do item selecionado'});
  await expect(sources).toContainText('O sistema deve permitir consultar o projeto 1.');
  await page.getByRole('button',{name:'Corrigir conteúdo',exact:true}).click();
  await page.getByRole('textbox',{name:'Título',exact:true}).fill('Título em edição');
  const list=page.getByRole('navigation',{name:'Selecionar requisito'});
  await list.getByRole('link',{name:/RF-002/}).click();
  await expect(page.getByRole('alertdialog')).toBeVisible();
  await page.getByRole('button',{name:'Voltar à edição',exact:true}).click();
  await expect(page.getByRole('textbox',{name:'Título',exact:true})).toHaveValue('Título em edição');
  await page.getByRole('button',{name:'Descartar alterações',exact:true}).click();
  await list.getByRole('link',{name:/RF-002/}).click();
  await expect(page).toHaveURL(/item=req-2/);
  await expect(sources).toContainText('O sistema deve permitir consultar o projeto 2.');
  await expect(sources).not.toContainText('O sistema deve permitir consultar o projeto 1.');
  await page.screenshot({path:testInfo.outputPath('bancada-desktop.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
  await page.screenshot({path:testInfo.outputPath('bancada-mobile.png'),fullPage:true});
});

test('histórico móvel pagina eventos e permite inspecionar um registro pelo teclado',async({page},testInfo)=>{
  const events=Array.from({length:60},(_,i)=>({id:String(i+1),kind:'artifact_produced',agent:'requirements',occurred_at:'2026-11-08T12:00:00Z',payload:{text:`Artefato registrado ${i+1}`}}));
  await page.route('**/api/research/runs/demo/events?**',route=>route.fulfill({json:{data:{events,has_more:false,cursor:'60',history_mode:'legacy',status:'completed',summary:{requests:0,completed_cycles:0,technical_retries:0,by_pair:[]}}}}));
  await page.route('**/api/research/runs/demo/events/1',route=>route.fulfill({json:{data:{data:{summary:'Conteúdo preservado do primeiro artefato'}}}}));
  await page.setViewportSize({width:390,height:844});
  await page.goto('/admin/runs/demo?view=timeline');
  const list=page.getByRole('list',{name:'Eventos da análise'});
  await expect(list.getByRole('button')).toHaveCount(10);
  await expect(page.getByRole('status').filter({hasText:'Página'})).toHaveText('Página 2 de 2');
  await page.getByRole('button',{name:'Eventos anteriores',exact:true}).click();
  await expect(list.getByRole('button')).toHaveCount(50);
  await list.getByRole('button').first().focus();await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toContainText('Conteúdo preservado do primeiro artefato');
  await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(list.getByRole('button').first()).toBeFocused();
  await page.getByRole('button',{name:'Diagrama',exact:true}).click();
  await expect(page.getByRole('group',{name:'Diagrama de sequência dos agentes'})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
  await page.getByRole('button',{name:'Lista',exact:true}).click();
  await page.screenshot({path:testInfo.outputPath('historico-mobile.png'),fullPage:true});
});
