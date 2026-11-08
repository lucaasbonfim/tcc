# Frontend do painel de pesquisa

React, Vite, Tailwind e React Router preservados. Configure `VITE_API_URL` no `.env` como `http://localhost:3000/api` e use `FRONTEND_URL=http://localhost:5173` no backend.

```powershell
npm ci
npm run dev
npm run lint
npm run build
```

A rota inicial redireciona para o painel protegido `/admin`; login em `/admin/login`. Projetos, documentos, requisitos, casos, execuções, análise e relatórios compõem o fluxo ativo. Componentes e páginas históricos continuam no código para referência, sem rotas de participantes ou dependência de `ParticipantProvider` na aplicação ativa.

A página de execução consulta o servidor a cada quatro segundos somente enquanto pendente/em andamento. Requisitos/casos permitem **Corrigir conteúdo → Salvar correção**, sem aprovar individualmente. O botão no início da lista aprova todos os pendentes e avança: requisitos geram casos; casos abrem Scripts. Rejeitados permanecem excluídos. Observações são opcionais; o histórico registra a ação e cada alteração. Edições não salvas bloqueiam o botão até salvar/descartar. Contadores de versão impedem aprovar dados obsoletos; a etapa aprovada fica congelada. Erros e indisponibilidades são apresentados sem resultados fictícios. O cliente usa cookie HTTP-only, não armazena token em localStorage.

A aba Casos apresenta requisitos com cenários vinculados, matriz por código, contagem de vínculos já aprovados e progresso/erros dos lotes. **Gerar casos para os requisitos sem cenário** complementa somente as lacunas, preservando resultados anteriores. A etapa fica bloqueada enquanto houver requisito sem caso aceito. Vínculo representa rastreabilidade declarada; a conferência do cenário continua humana.

A aba Scripts reúne inspeção de módulos/fontes no SHA, seleção de alvos/casos e revisão do código gerado pelo agente 2. Aprovar scripts não autoriza executá-los. Execução verifica disponibilidade real do serviço e exige justificativa; sem perfil validado, o botão permanece bloqueado. O perfil local aparece como **Docker Desktop · desenvolvimento local**, inclusive nos resultados preservados. Logs, comandos, ambiente e resultados ficam consultáveis. Análise conecta requisito/caso/script/resultado, preservando proposta automática e decisão humana separadas. Documentos extensos exibem partes e checkpoints. Para subir toda a aplicação localmente, use `npm run dev:local` na raiz.

Scripts seleciona todos os cenários aprovados por padrão, sem limite de vinte na seleção. Há controles para selecionar todos/limpar ou escolher um subconjunto. A geração percorre lotes pequenos e mostra progresso, scripts gerados, impossibilidades justificadas e casos ainda faltantes. Código fica recolhido por script; **Salvar correção do script** preserva versão sem aprovar. **Aprovar todos os scripts e continuar** conclui a revisão em uma operação, preservando rejeitados; rascunhos não salvos bloqueiam esse botão. A execução mantém autorização e limites próprios.

O pesquisador escolhe o módulo inteiro, sem selecionar fontes manualmente. O painel mostra arquivos lidos/omitidos/lotes de leitura e, em detalhes, os escopos automáticos e as restrições por arquivo. Fontes com dependência indireta de banco são identificadas no planejamento. Um cenário sem script em um escopo é considerado nos demais antes da justificativa final. Ler todas as fontes não implica suporte de execução a Swing ou banco.

## Testes no navegador

Para validar a interface sem banco de dados, execute a suíte com respostas HTTP simuladas:

```powershell
npx playwright install chromium
npx playwright test --config playwright.ui.config.js
```

No Windows, é possível usar o Edge instalado com `$env:PLAYWRIGHT_CHANNEL='msedge'`.
Essa suíte usa a porta 5189 e verifica navegação móvel, proteção de rascunhos,
fontes vinculadas ao item selecionado, paginação e teclado no histórico, busca
sem resultados e conferência das entradas antes de iniciar a análise.

A revisão apresenta um item por vez, selecionado pela URL, com suas fontes ao lado.
O histórico oferece lista e diagrama, em páginas de até 50 eventos; filtros e página
ficam na URL. Fontes IBM Plex são distribuídas com a aplicação, sem requisições a um CDN.

Para o fluxo integrado com persistência, use a suíte abaixo:

```powershell
npx playwright install chromium
$env:TEST_DATABASE_URL='postgresql://usuario:senha@localhost:5432/tcc_test_browser'
npm run test:e2e
```

Crie antes um banco separado `tcc_test_browser`. A suíte inicia seus próprios servidores em 5178/3101 e usa serviços reais de persistência/autenticação, com GitHub/Gemini/executor injetados e identificados como fixtures técnicas. Verifica o fluxo até scripts, bloqueio sem executor, evidências, revisão humana, exportação e modo móvel. O habilitador de executor fictício existe apenas no servidor de testes, nunca na API real. Não inicia o servidor de produção nem usa créditos de IA. `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` permite reutilizar um executável Chromium instalado. Capturas/trace ficam em `test-results` (ignorado no Git).

[Instalação completa](../README.md) e [arquitetura/limitações](../docs/ARQUITETURA_PESQUISA.md).
