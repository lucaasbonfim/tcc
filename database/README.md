# Banco PostgreSQL

A plataforma atual utiliza exclusivamente o schema `research`, evoluído pelas migrações aditivas em `migrations`. Execute dentro de `backend`:

```powershell
npm run migrate
```

O runner aplica somente arquivos em `database/migrations`, sob transação e advisory lock. Registra nome, checksum SHA-256 (normalizando CRLF/LF) e data em `research.migrations`. Reexecutar não reaplica migrações; alterar um arquivo já aplicado provoca erro. Acrescente novas migrações para evoluir ambientes existentes.

| Migração | Conteúdo |
| --- | --- |
| 009 | Fundação, projetos/documentos, etapas, requisitos/casos e revisões |
| 010 | Inspeções técnicas no SHA |
| 011 | Subetapa de automação e scripts versionados |
| 012 | Trabalhos do executor, evidências e resultados individuais |
| 013 | Análises do agente 4 e decisão humana separada |
| 014 | Partes/checkpoints de requisitos e consolidação |
| 015 | Continuação de execuções e origem dos checkpoints reaproveitados |
| 016 | Decisão de edição separada da aprovação, preservando antes/depois |
| 017 | Lotes/checkpoints de casos, códigos dos requisitos, mapeamentos e vínculo às tentativas |
| 018 | Lotes de scripts, cenários-alvo, decisões por cenário e tentativas de geração |
| 019 | Sessões, turnos e chamadas de ferramentas dos agentes; vínculos, contadores e idempotência |
| 020 | Papel A1, sessões por parte de requisitos e unicidade da sessão ativa por unidade de trabalho |
| 021 | Papel A2 textual e sessões por lote de casos, com retomada e orçamento por unidade |
| 022 | Papel A4 com sessões de investigação de evidências por etapa |
| 023 | Mensagens A2 → A1, vínculos/revisões imutáveis e sessões filhas com retomada e orçamento |
| 024 | Planos de execução, vários bundles por análise e tentativas por trabalho; planos legados preservam IDs/evidências |
| 025 | Sessões A3 por fase, propostas imutáveis de plano/diagnóstico e vínculo à autorização |
| 026 | Consulta A3 → A2 sobre script/versão/resultado, com integridade do vínculo e sessão filha A2 |
| 027 | Condição autônoma, autorização inicial, elegibilidade técnica separada da revisão e fundação de eventos/snapshots |

API e worker recusam iniciar com migração pendente ou checksum divergente. A atualização não remove tabelas/dados históricos. Evidências e resultados possuem FKs para a cadeia da execução; não há importação manual de evidências pelo painel.

Para verificar a evolução dos agentes em um banco separado, dentro de `backend`, use `node scripts/test-agents-local.mjs`. Configure `TEST_DATABASE_URL` para um banco existente `tcc_test_*`; opcionalmente salve essa variável em `.local/agent-tests.env` na raiz, ignorado pelo Git. O helper valida o destino, passa a URL ao processo de testes sem exibi-la e não infere nem cria o destino a partir do banco da pesquisa. Aceita caminhos de testes como argumentos. Fixtures permanecem no banco de teste, separado dos dados reais.

Para E2E, use `node scripts/test-agents-local.mjs --browser` e configure `TEST_BROWSER_DATABASE_URL` em **outro banco** `tcc_test_*`. O helper recusa o mesmo nome de banco para as duas suítes: seus workers não podem disputar a mesma fila de fixtures. `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` pode selecionar um Chromium já instalado, conforme a configuração do frontend.

Os scripts do experimento anterior foram removidos do repositório e permanecem consultáveis no histórico do Git. A numeração da migração atual foi mantida para preservar os registros e checksums de ambientes já inicializados. Nenhuma tabela existente é apagada ou convertida pela remoção desses arquivos.

As entidades efetivamente criadas, FKs e diagrama estão em [Arquitetura](../docs/ARQUITETURA_PESQUISA.md). Documentos e respostas grandes ficam em armazenamento privado de artefatos; suas referências e hashes ficam no PostgreSQL. Backup somente do banco não preserva os PDFs/extrações/entradas/saídas.

Testes de integração exigem `TEST_DATABASE_URL` e nome de banco com prefixo `tcc_test_`. O runner de testes jamais deve apontar para o banco da pesquisa. Fixtures permanecem nesse banco separado; artefatos da suíte são temporários. Crie novo banco de teste para uma execução totalmente vazia.
