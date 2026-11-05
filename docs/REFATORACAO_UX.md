# Refatoração da jornada do Requisita — 05/11/2026

## Problema e resultado

A interface anterior exigia conhecer a arquitetura e atravessar controles técnicos para operações comuns. A nova jornada apresenta primeiro projeto, documentos, modo e próxima ação, mantendo detalhes científicos e operacionais consultáveis. Nenhuma etapa é simulada. Esta mudança melhora a operação da ferramenta; não é evidência empírica de melhoria de usabilidade com participantes.

## Organização implementada

1. **Início:** análises abertas/pendentes de revisão e projetos disponíveis. Indicadores e relatórios ficam em seção secundária.
2. **Projetos:** cadastro com nome, repositório e descrição opcional. Referência Git, ambiente e texto complementar permanecem disponíveis em opções adicionais. A branch padrão continua sendo resolvida e versionada pelo backend.
3. **Preparação:** documentos e extração antes dos controles de análise. Modo assistido como padrão; configurações individuais sob demanda. Defaults científicos anteriores preservados. Escolher autonomia continua selecionando ferramentas para os quatro papéis e solicita autorização inicial com inspeção e executor compatível.
4. **Resumo da análise:** próxima ação conforme estados reais, etapas, quatro agentes e resultados observados. Scripts ficam associados ao A2. Filas, falhas, revisões e impossibilidade de automação têm encaminhamentos distintos.
5. **Revisão:** conteúdo principal compacto, fontes/fluxos e edição sob demanda. Rejeição do item exige escolha de motivo; aprovação em lote preserva IDs/revisões e rejeições. Correções não salvas bloqueiam mudança de aba/rota e recarga. Scripts usam a mesma proteção.
6. **Scripts:** módulo, casos selecionados e viabilidade em primeiro plano. Todos os aprovados continuam selecionados por padrão; seleção individual é opcional. Escopos, adaptadores, arquivos e lotes ficam em detalhes. Limitações que impedem geração continuam visíveis.
7. **Execução:** preparação do plano separada da autorização. Finalidade escolhida conscientemente e checkbox de confirmação do escopo. Código, ambiente, imagens/política e limites continuam acessíveis; backend mantém verificações originais. Sem executor/adaptador compatível, autorização fica bloqueada.
8. **Resultados:** evidências e classificações propostas permanecem distintas de diagnósticos técnicos e julgamentos humanos. Logs e detalhes podem ser expandidos. A avaliação posterior da análise também está disponível nesta área.

O mapa dos agentes, consultas reais, animações, diagrama de sequência, histórico por momento e acesso ao artefato preservado continuam na área de acompanhamento. URLs antigas e exportações JSON/CSV permanecem acessíveis. Navegação principal tem apenas Início, Projetos e Análises.

## Registros operacionais e decisões humanas

O backend já exigia justificativa nas ações operacionais e registrava algumas como aprovações. Para os novos clientes, `operation_record:'system/v1'` solicita descrição padronizada gerada no servidor. O evento `operation_requested` identifica origem `system`, solicitante pesquisador, operação/escopo e `human_approval:false`. Não é parecer acadêmico nem aprovação de conteúdo. Não se pode combinar essa origem com texto de justificativa humana. Clientes antigos continuam funcionando.

Aplicado apenas à geração de scripts, preparação do plano, complementação de casos, continuação e retomada. Não habilita execução, não aprova itens nem contorna autorização. Revisões, rejeições, aprovação em lote, diagnósticos, classificações e julgamentos conservam seus registros humanos próprios. Nas autorizações, as finalidades predefinidas só são enviadas depois da escolha consciente do usuário; outra finalidade admite descrição livre.

O cancelamento oferece motivos predefinidos e observação opcional. A ação humana é preservada como cancelamento; não é inventada uma justificativa em nome do pesquisador.

## Métricas da interface

Contagens são descrições dos registros, sem estimativa de precisão, cobertura semântica ou prova de defeito. “Casos com teste concluído” conta casos distintos com pelo menos um resultado `passed` ou `failed`; falhas de compilação/infraestrutura, omissões e estados sem conclusão não são contados como caso executado. Aprovados/reprovados contam registros de teste; problemas técnicos são apresentados à parte. Inconclusivos não incluem automaticamente cancelados, omitidos ou não suportados: todos os estados originais continuam na tabela e nos detalhes. Julgamentos humanos não sobrescrevem classificações da IA.

## Arquivos principais

- Jornada e estilos: `ResearchLayout`, páginas `ResearchDashboardPage`, `ResearchProjectFormPage`, `ResearchProjectPage`, `ResearchProjectsPage`, `ResearchRunsPage`, `journey.css`, `Button` e `Card`.
- Análise: `ResearchRunPage`, `ResearchRunOverview`, `run-journey.js`, `ResearchReviewItem`, `ResearchAutomationPanel`, `ResearchExecutionPanel`, `ResearchEvaluationPanel`, `ResearchAutonomySetup`, `ResearchAuthorizationReason`, `UnsavedChangesGuard` e `App.jsx`.
- Registros: `operational-record.js`, `automation.js`, `execution.js`, `runs.js`, timeline e projeção dos eventos. Router mantém o limite padrão de produção; servidor E2E recebe limite próprio para compartilhar um IP entre testes, sem alterar o padrão de segurança.
- Recuperação: `agent-policy.js`, `agent-runtime.js`, `agent-sessions.js` e contagem no histórico. Política versionada e compatibilidade descritas no diário RT-01/RT-02.

## Validação e limites

- PostgreSQL local isolado: suíte completa com **135 testes aprovados**, sem ignorados. Após refinamento de validação do contrato operacional, **6 controles específicos aprovados**, incluindo autenticação/origem, geração, planejamento e recusa de autorização sem justificativa.
- Frontend: lint e build aprovados; carregamento da análise separado para evitar um pacote inicial único acima de 500 kB. **12 testes de projeção/jornada/contagens aprovados**.
- E2E: **12 testes aprovados** na suíte completa, com fixtures explícitas. Cobrem assistência/autonomia, quatro agentes, consultas, falha legada 503, recuperação de dois 503 sem repetir a etapa, revisões, snapshots, exportação, autorização, proteção de rascunhos e todos os 104 casos selecionados/gerados em lotes. Refinamentos de apresentação posteriores são conferidos nos testes de jornada e fluxo assistido.
- Conferência visual: desktop de 1280 px e mobile de 390 px, incluindo preparação, resumo, mapa, falha e histórico. Sem transbordamento horizontal da página; diagrama/tabelas possuem rolagem própria quando necessária. Redução de movimento preservada.

Não foram feitas chamadas reais ao Gemini nesta implementação. O VVV original e o banco de pesquisa não foram alterados. O teste de retries reproduz respostas controladas, não disponibilidade real da API. Ainda faltam piloto conjunto com LLM real e protocolo científico final; a interface não resolve essas pendências metodológicas. Não foi realizado estudo formal de usabilidade. Não houve alteração de `.env`, credenciais, dependências ou garantias do executor. Não houve push remoto; `atual.java` permanece local e intacto.
