# Backend da plataforma de pesquisa

Express e PostgreSQL com autenticação administrativa reaproveitada. Instalação e variáveis: [README principal](../README.md). Execute os comandos dentro de `backend`.

```powershell
npm ci
npm run migrate
npm start
# Outro terminal:
npm run worker
```

`npm run dev` usa nodemon para a API; o worker é um processo separado e deve ser reiniciado após alterações no seu código. O diretório de artefatos e o banco precisam ser os mesmos nos dois processos.

Para rodar tudo com Docker Desktop, use **`npm run dev:local` na raiz**. O launcher injeta o perfil/URL/token/política locais na API e worker, inicia o executor separado e o frontend, sem alterar `.env`. [Guia local](../docs/DESENVOLVIMENTO_LOCAL.md). Não inicie estes processos em paralelo com o launcher.

## API ativa

Prefixo: `/api`. Respostas de recursos usam `{data: ...}`; erros, `{error: ...}`. Login usa cookie HTTP-only `tcc_session`; não há token no corpo. Todas as rotas `/research` exigem administrador, inclusive leitura/download/exportação. Escritas verificam a origem de `FRONTEND_URL`. O sistema é de um pesquisador/administrador, sem contas múltiplas.

| Método | Caminho | Uso |
| --- | --- | --- |
| GET | `/health` | Liveness da API |
| POST | `/auth/admin/login` | `{email,password}` |
| GET | `/auth/me` | Sessão administrativa |
| POST | `/auth/logout` | Encerrar sessão |
| GET | `/research/capabilities` | Disponibilidade real, recibo do executor e adaptadores |
| GET | `/research/summary` | Contagens globais reais do dashboard |
| GET/POST | `/research/projects` | Listar/cadastrar projeto |
| GET/PUT | `/research/projects/:projectId` | Consultar/editar e resolver nova versão |
| POST | `/research/projects/:projectId/documents` | Corpo binário PDF/TXT/MD |
| GET | `/research/projects/:projectId/documents/:documentId` | Extração por página e metadados |
| GET | `/research/projects/:projectId/documents/:documentId/download` | Arquivo original privado |
| POST | `/research/projects/:projectId/versions/:versionId/inspect` | Inspeção declarativa, corpo `{}` |
| POST | `/research/projects/:projectId/runs` | Enfileirar, resposta 202 |
| GET | `/research/runs` | Até 500 execuções mais recentes |
| GET | `/research/runs/:runId` | Snapshot, etapas, saídas validadas e histórico |
| POST | `/research/runs/:runId/reviews/:kind/:itemId` | Revisar requisito (`requirements`) ou caso (`tests`) |
| POST | `/research/runs/:runId/approve/:agent` | Aprovar etapa `requirements` ou `tests` |
| POST | `/research/runs/:runId/retry` | Repetir etapa falha, máximo três tentativas |
| POST | `/research/runs/:runId/resume` | Continuar requisitos falhos com checkpoints, nova execução vinculada, resposta 202 |
| POST | `/research/runs/:runId/cancel` | Cancelar sem apagar histórico |
| POST | `/research/runs/:runId/automation` | Gerar scripts com inspeção/módulo/alvos/casos aprovados |
| GET | `/research/runs/:runId/automated-tests` | Scripts e arquivos versionados |
| POST | `/research/runs/:runId/automated-tests/:itemId/review` | Revisar/corrigir arquivos de um script |
| POST | `/research/runs/:runId/automation/approve` | Concluir revisão de scripts |
| POST | `/research/runs/:runId/execution` | Autorizar trabalho isolado, resposta 202 |
| POST | `/research/runs/:runId/evaluation` | Enfileirar avaliação de evidências prévias, quando ainda não iniciada |
| POST | `/research/runs/:runId/findings/:itemId/review` | Decisão humana sobre a proposta de avaliação |
| POST | `/research/runs/:runId/evaluation/approve` | Concluir revisão de todas as análises |
| GET | `/research/runs/:runId/attempts/:attemptId/:type` | Entrada (`input`) ou saída (`output`) preservada |
| GET | `/research/runs/:runId/export/:format` | JSON ou CSV por execução |

Cadastro/edição envia `name`, `repository_url`, `requested_ref` e campos opcionais `description`, `technical_notes`, `complementary_text`. A referência vazia usa a branch padrão. Edição cria nova versão de código resolvida; não altera versões antigas.

Upload: `Content-Type: application/pdf` (ou `text/plain`/`text/markdown`) e `X-File-Name: encodeURIComponent(nome)`. Não é multipart. Até 10 MiB, 200 páginas e 200 mil caracteres por documento. Até 20 versões e 100 MiB por projeto. PDF sem texto recebe aviso; não há OCR. Download valida vínculo e hash. Os dados ficam fora do diretório público.

Criação de execução: `{code_version_id,document_ids}` opcional; omissão seleciona código mais recentemente resolvido e a última versão de cada nome de documento. Inclui texto complementar. Mais de 24 mil caracteres ou 40 páginas cria partes/checkpoints; segmentos de até 6000 caracteres, orçamento de 8000 mais sobreposição de 600 e até 40 fragmentos por grupo. Até 4,1 milhões selecionados, 512 partes, 2000 requisitos e 12 MiB por artefato, sem truncamento silencioso. Uma execução ativa por projeto.

Continuação: `{justification}` em `/resume`, somente para requisitos falhos com partes concluídas e restantes. Cria `resumed_from_run_id`, preservando snapshot/SHA/documentos/modelo/parâmetros originais e registrando as instruções atuais na nova etapa. Valida os checkpoints antes de reutilizar referências (`reused_from_part_id`); redivide apenas o restante. Não altera contadores/histórico anteriores nem repete chamadas concluídas. Exportação JSON inclui entradas/saídas e tentativas dos checkpoints reaproveitados, sem contá-las como novas chamadas.

Agente 1 v1.1: a entrada preservada contém `source_catalog` com IDs, documento/página, offsets UTF-16 e trechos literais. O modelo retorna somente `source_id`; o servidor resolve as fontes e valida o contrato canônico. Artefatos preservam `raw` intacto e, quando validado, `validated_output`/`citation_method`. IDs inexistentes são rejeitados; nenhuma citação é corrigida por aproximação. `MAX_TOKENS` é registrado explicitamente como resposta incompleta.

Revisão: `{decision: 'approved'|'rejected'|'edited', justification, revision, content?}`. `edited` exige conteúdo corrigido, salva com estado pendente e registra antes/depois sem aprovar. Código é imutável, conteúdo é validado, `revision` deve coincidir com a versão corrente. Alteração concorrente retorna 409. Requisitos ficam congelados após autorizar o agente 2.

Aprovação em lote: `/approve/:agent` recebe `{approve_pending:true,items:[{id,revision}],justification}` com todos os itens da etapa exibida. Em uma transação, confere IDs/revisões, valida os conteúdos aceitos, aprova pendentes, preserva aprovados/rejeitados e conclui a etapa. Requer pelo menos um aceito; falha não deixa aprovação parcial. Cada item aprovado e a etapa possuem registro de auditoria; aprovação da etapa marca `approval_mode:'bulk'`. Requisição concorrente/obsoleta retorna 409. No painel, a observação é opcional: sem texto, envia a descrição da ação humana. O formato anterior `{justification}` continua disponível para clientes que já revisaram todos individualmente. Scripts e execução conservam suas autorizações próprias.

Automação: `{inspection_id,module_root,target_paths,test_case_ids?,justification}`. A inspeção deve pertencer à versão fixa da execução; até oito alvos, vinte casos aprovados e fechamento compatível com o adaptador. Revisão de script: `{decision,revision,justification,files?:[{path,code}]}`. Caminhos/caso/SHA/esperado são preservados; correção cria versão auditável. Aprovação da etapa não autoriza execução.

Execução: `{justification}` com etapa de scripts concluída e executor validado. Bundle e recibo são preservados; resultado precisa corresponder a UUID/hash/SHA/imagem/política/perfil. Não há endpoint de upload de evidências arbitrárias. Cliente separado, sem Docker no backend. Variáveis `EXECUTOR_MODE` (padrão `dedicated-vm`), `EXECUTOR_URL`, `EXECUTOR_TOKEN`, `EXECUTOR_DEPLOYMENT_ID` e `EXECUTOR_POLICY_SHA256` precisam ser iguais na API/worker. HTTPS no modo dedicado; HTTP somente em loopback literal para `docker-desktop-dev`, recusado em produção. O launcher configura tudo para desenvolvimento.

Avaliação humana: `{decision:'confirmed'|'rejected'|'inconclusive',revision,justification,classification?}`. Classes: `compatible`, `possible_functional_divergence`, `test_problem`, `environment_failure`, `inconclusive`. Proposta original e decisão humana permanecem separadas. Evidência válida enfileira o agente 4 automaticamente; inferência sem evidências não é permitida. Estados/contratos: [arquitetura](../docs/ARQUITETURA_PESQUISA.md).

## Operação e falhas

- Worker consulta a cada 2 s; lease de 180 s e timeout de inferência de 95 s. Interrupções exigem repetição explícita, preservando tentativas. Em documentos extensos, chamadas por parte têm registros próprios; checkpoints concluídos não são repetidos. Três sessões de tentativa da etapa, em vez de limitar o número de partes a três.
- Sem credenciais/modelo configurados, uma nova execução não é criada. Falhas do provedor são registradas sem cabeçalhos/segredos; respostas inválidas ficam disponíveis para auditoria.
- Banco remoto usa TLS com certificado verificado. Conexões têm prazo de 10 s. Para configuração de CA privada, adapte explicitamente a configuração de confiança; não desabilite verificação silenciosamente.
- API e worker verificam migrações/checksums no início e solicitam `npm run migrate` quando necessário. Health é liveness, não comprovação de disponibilidade do modelo/worker.
- `ARTIFACTS_DIR` padrão: `backend/artifacts`. Use caminho absoluto em implantação. Backup precisa incluir banco e arquivos; não existem coleta automática de órfãos ou quota global de disco.
- Rotas antigas de participantes, grupos e atividades estão desmontadas; módulos e tabelas históricos não são excluídos.

## Validação

`npm test` não chama o Gemini nem executa projetos externos. `TEST_DATABASE_URL` com banco `tcc_test_...` habilita integração. `npm run smoke:gemini` e `npm run smoke:automation` são separados e consomem API real, sem gravar resultados de pesquisa ou executar código gerado. `scripts/hash-password.js` recebe senha por stdin e imprime somente bcrypt. Testes do executor ficam em `../executor`; pilotos reais exigem probes e recibo válidos no perfil explicitamente escolhido. Piloto Node local registrado em [PILOTO_EXECUCAO.md](../docs/PILOTO_EXECUCAO.md).
