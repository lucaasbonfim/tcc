# Frontend do painel de pesquisa

React, Vite, Tailwind e React Router preservados. Configure `VITE_API_URL` no `.env` como `http://localhost:3000/api` e use `FRONTEND_URL=http://localhost:5173` no backend.

```powershell
npm ci
npm run dev
npm run lint
npm run build
```

A rota inicial redireciona para o painel protegido `/admin`; login em `/admin/login`. Projetos, documentos, requisitos, casos, execuções, análise e relatórios compõem o fluxo ativo. Componentes e páginas históricos continuam no código para referência, sem rotas de participantes ou dependência de `ParticipantProvider` na aplicação ativa.

A página de execução consulta o servidor a cada quatro segundos somente enquanto pendente/em andamento. Revisões têm justificativa, contador de versão e bloqueio após aprovar a etapa. Erros e indisponibilidades são apresentados sem resultados fictícios. O cliente usa cookie HTTP-only, não armazena token em localStorage.

A aba Scripts reúne inspeção de módulos/fontes no SHA, seleção de alvos/casos e revisão do código gerado pelo agente 2. Aprovar scripts não autoriza executá-los. Execução verifica disponibilidade real do serviço dedicado e exige justificativa; sem infraestrutura validada, o botão permanece bloqueado. Logs, comandos, ambiente e resultados ficam consultáveis. Análise conecta requisito/caso/script/resultado, preservando proposta automática e decisão humana separadas. Documentos extensos exibem partes e checkpoints.

## Testes no navegador

```powershell
npx playwright install chromium
$env:TEST_DATABASE_URL='postgresql://usuario:senha@localhost:5432/tcc_test_browser'
npm run test:e2e
```

Crie antes um banco separado `tcc_test_browser`. A suíte inicia seus próprios servidores em 5178/3101 e usa serviços reais de persistência/autenticação, com GitHub/Gemini/executor injetados e identificados como fixtures técnicas. Verifica o fluxo até scripts, bloqueio sem executor, evidências, revisão humana, exportação e modo móvel. O habilitador de executor fictício existe apenas no servidor de testes, nunca na API real. Não inicia o servidor de produção nem usa créditos de IA. `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` permite reutilizar um executável Chromium instalado. Capturas/trace ficam em `test-results` (ignorado no Git).

[Instalação completa](../README.md) e [arquitetura/limitações](../docs/ARQUITETURA_PESQUISA.md).
