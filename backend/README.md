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

## API ativa

Prefixo: `/api`. Respostas de recursos usam `{data: ...}`; erros, `{error: ...}`. Login usa cookie HTTP-only `tcc_session`; não há token no corpo. Todas as rotas `/research` exigem administrador, inclusive leitura/download/exportação. Escritas verificam a origem de `FRONTEND_URL`. O sistema é de um pesquisador/administrador, sem contas múltiplas.

| Método | Caminho | Uso |
| --- | --- | --- |
| GET | `/health` | Liveness da API |
| POST | `/auth/admin/login` | `{email,password}` |
| GET | `/auth/me` | Sessão administrativa |
| POST | `/auth/logout` | Encerrar sessão |
| GET | `/research/capabilities` | Disponibilidade real das etapas |
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
| POST | `/research/runs/:runId/cancel` | Cancelar sem apagar histórico |
| GET | `/research/runs/:runId/attempts/:attemptId/:type` | Entrada (`input`) ou saída (`output`) preservada |
| GET | `/research/runs/:runId/export/:format` | JSON ou CSV por execução |

Cadastro/edição envia `name`, `repository_url`, `requested_ref` e campos opcionais `description`, `technical_notes`, `complementary_text`. A referência vazia usa a branch padrão. Edição cria nova versão de código resolvida; não altera versões antigas.

Upload: `Content-Type: application/pdf` (ou `text/plain`/`text/markdown`) e `X-File-Name: encodeURIComponent(nome)`. Não é multipart. Até 10 MiB, 200 páginas e 200 mil caracteres por documento. Até 20 versões e 100 MiB por projeto. PDF sem texto recebe aviso; não há OCR. Download valida vínculo e hash. Os dados ficam fora do diretório público.

Criação de execução: `{code_version_id,document_ids}` opcional; omissão seleciona código mais recentemente resolvido e a última versão de cada nome de documento. Inclui texto complementar. Não há truncamento automático: mais de 100 mil caracteres de fonte gera 422. Uma execução ativa por projeto.

Revisão: `{decision: 'approved'|'rejected', justification, revision, content?}`. Código é imutável, conteúdo é validado, `revision` deve coincidir com a versão corrente. Alteração concorrente retorna 409. Aprovação de etapa, repetição e cancelamento exigem `{justification}`. Todos os itens precisam de decisão e pelo menos um aprovado para aprovar a etapa. Requisitos aprovados ficam congelados após autorizar o agente 2.

Estados e contratos: [arquitetura implementada](../docs/ARQUITETURA_PESQUISA.md). O quarto agente não faz inferência sem evidências e não há endpoint para habilitar execução externa nesta versão. Casos textuais não são scripts.

## Operação e falhas

- Worker consulta a cada 2 s; lease de 180 s e timeout de inferência de 95 s. Interrupções exigem repetição explícita, preservando tentativas.
- Sem credenciais/modelo configurados, uma nova execução não é criada. Falhas do provedor são registradas sem cabeçalhos/segredos; respostas inválidas ficam disponíveis para auditoria.
- Banco remoto usa TLS com certificado verificado. Conexões têm prazo de 10 s. Para configuração de CA privada, adapte explicitamente a configuração de confiança; não desabilite verificação silenciosamente.
- A API verifica a existência do schema no início e solicita `npm run migrate` quando necessário. Health é liveness, não comprovação de disponibilidade do modelo/worker.
- `ARTIFACTS_DIR` padrão: `backend/artifacts`. Use caminho absoluto em implantação. Backup precisa incluir banco e arquivos; não existem coleta automática de órfãos ou quota global de disco.
- Rotas antigas de participantes, grupos e atividades estão desmontadas; módulos e tabelas históricos não são excluídos.

## Validação

`npm test` não chama o Gemini. `TEST_DATABASE_URL` com banco `tcc_test_...` habilita integração. `npm run smoke:gemini` é separado e consome API real; não grava resultados de pesquisa. `scripts/hash-password.js` recebe senha por stdin e imprime somente bcrypt.
