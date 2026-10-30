# Registro de validação

## Diagnóstico

- `git status --short`: limpo antes das mudanças.
- Inspecionados: rotas e inicialização Express, autenticação, serviços de geração/prompt/persistência, componentes de navegação e proteção, SQL histórico e configurações.
- Node disponível: 20.20.0. PostgreSQL 17 instalado e serviço ativo. Docker sem daemon acessível.
- Plano documental verificado com `git diff --check`; nenhuma alteração nos scripts históricos ou dados.

## Fundação PostgreSQL

- Schema `research` independente; migração transacional sob advisory lock e checksum normalizado entre Windows/Linux.
- `node --test test`: validações e rollback aprovados; integração depende de `TEST_DATABASE_URL`.
- `TEST_DATABASE_URL` apontando para cluster PostgreSQL 17 local separado: migração aplicada, reaplicação sem alterações e FK inválida rejeitada.
- O banco configurado no `.env` é acessível, mas não foi migrado: somente o banco local `tcc_test_research` recebeu dados de teste.

## Projetos e documentos

- APIs administrativas de listagem/cadastro/edição e upload/consulta/download; rotas antigas retiradas do router ativo, sem apagar módulos ou dados.
- Testes: rejeição de URLs internas e credenciais, resolução de SHA com transporte simulado, erros GitHub, hash e travessia de artefatos, PDF textual real/sem texto/corrompido, UTF-8, limites, controle de acesso e origem.
- PostgreSQL separado: versões de projeto e documento, extrações preservadas e migração reexecutada.
- `pdfjs-dist` 5.5.207: compatível com Node 20.19+, fora do intervalo vulnerável 5.6.83–6.2.107 apontado pelo audit; interpretação de JavaScript desabilitada. Avaliar atualização para Node 22 e PDF.js 6 em evolução posterior.
- `npm audit fix` aplicou atualizações compatíveis das dependências existentes; auditoria do backend: zero vulnerabilidades.

## Contratos e modelo

- Instruções versionadas e contratos separados para requisitos e casos; responsabilidades explícitas para execução e avaliação não suportadas.
- Testes locais de citações/páginas, códigos duplicados, referências a requisitos inexistentes, falso artefato executável e cliente Gemini injetado: aprovados.
- Gateway real preserva modelo solicitado, versão retornada, tokens quando informados e custo nulo quando indisponível. Dados não confiáveis são separados da instrução de sistema; sem ferramentas do modelo.
- `npm test`: 11 aprovados, duas integrações ignoradas nesta invocação sem URL de teste. A suíte não chama o provedor.

## Orquestração e revisões

- Worker separado com claim transacional, `SKIP LOCKED`, lease de 180 s, prazo de inferência de 95 s e máximo de três tentativas por etapa. Repetições exigem justificativa; não há repetição paga automática.
- Snapshot preserva projeto, SHA, versões e texto dos documentos, definições/instruções/contratos dos agentes; tentativas guardam entrada, saída bruta, metadados disponíveis e duração.
- Revisão de cada item com justificativa, cópia antes/depois e revisão numérica para evitar sobrescrita concorrente. Geração recebe somente requisitos aprovados; conclusão exige revisar todos e aprovar pelo menos um item.
- PostgreSQL isolado: pipeline completo, prevenção de duplicação e claims concorrentes, snapshot imutável, rastreabilidade, correção auditada, JSON inválido, limite de repetição, cancelamento durante inferência e recuperação de lease expirado.
- `TEST_DATABASE_URL=... npm test`: 19 testes aprovados, sem chamadas à API de IA. Execução e avaliação permanecem `not_supported`, inclusive em execuções concluídas de geração textual.

## Exportação e inspeção técnica

- Exportação JSON inclui snapshot, instruções, tentativas/entradas/saídas e revisões; CSV usa linhas por entidade, vínculos e payload JSON, com escape de fórmulas e delimitadores.
- Adaptador declarativo `node-built-in-test/v1` identifica apenas script exato `node --test`, sugere comando fixo e mantém execução bloqueada. Maven é identificado sem executor; manifestos limitados à raiz e SHA registrado.
- Testes de exportação e inspeção com transporte injetado; `node --check backend/src/research/{worker,runs,processor}.js` e suíte com PostgreSQL: 21 testes aprovados.

## Compatibilidade real do Gemini

- Teste manual separado da suíte, com texto sintético explicitamente técnico: provedor acessível e análise de requisitos validada com citação existente.
- O modelo configurado `gemini-3.5-flash-lite` rejeitou o JSON Schema com limites aninhados (`400 invalid argument`). A configuração agora envia estrutura/tipos/enums/campos obrigatórios sem limites que multiplicam a complexidade. O contrato completo e todos os limites continuam obrigatórios no backend.
- Após o ajuste: um requisito válido; provedor reportou 250 tokens de entrada, 176 de saída, total 426 na chamada diagnóstica. Sem custo informado. Esses valores são validação técnica, não resultados da pesquisa.

## Fundação da interface de pesquisa

- Novo layout reutiliza Tailwind e os componentes existentes, com navegação responsiva, estados em português, cliente de API autenticado e hook com cancelamento e polling limitado a etapas ativas.
- `npm run build` e `npm run lint`: aprovados, sem avisos de lint após correção dos estados derivados.
- Auditoria também identificou Vite vulnerável já instalado; atualização compatível para 8.3.5 validada no build (lockfile incluído com a infraestrutura E2E).

## Telas de projetos

- Dashboard com contagens consultadas do banco, cadastro/edição com resolução de SHA, seleção de documentos/versões, upload, consulta de páginas extraídas e histórico por projeto.
- Build/lint aprovados. Fluxos de cadastro/importação exercitados no Chromium contra API e PostgreSQL isolados.

## Navegação, revisão e histórico

- Fluxo ativo substituído pelo painel de pesquisa, sem provider/onboarding ou menus do experimento anterior. Autenticação administrativa preservada.
- Páginas de requisitos, casos, execuções, análise e relatórios; correções em campos estruturados, justificativa e aprovação por item/etapa; entradas/saídas brutas, alertas, tokens e revisões consultáveis.
- Backend apresenta alertas das saídas validadas para consulta. Build/lint e testes de integração continuam aprovados.

## Revisão de segurança

- Proteção de origem aplicada também ao login/logout; sessões antigas de participantes deixam de consultar tabelas do experimento anterior.
- Limite de dois parsers PDF simultâneos por processo, além de memória/prazo/tamanho. TLS PostgreSQL passa a verificar certificado; conexão configurada validada por `SELECT 1`, sem migração ou escrita.
- Falhas de tipo no login viram rejeição de autenticação. Respostas tardias após cancelamento preservam metadados e duração, sem criar resultados ou reabrir execução.
- API, contratos e integração PostgreSQL: 22 testes aprovados. Scripts históricos continuam intactos.

## Validação final da primeira base

- `npm run smoke:gemini`: dois agentes reais, um requisito e dois casos válidos a partir de texto sintético. Gemini reportou 527 e 914 tokens totais, respectivamente; custo não informado. Sem gravação no banco da pesquisa.
- Integração GitHub real: repositório público do projeto e referência `main` resolvidos para SHA de 40 caracteres; nenhum clone/comando do projeto executado.
- Playwright/Chromium: cadastro, upload/consulta TXT, correção de título com revisão, aprovação dos dois agentes, exportação JSON conferindo rastreabilidade e antes/depois; viewport 390 px sem overflow e sem erros JavaScript. Capturas desktop/móvel inspecionadas. A primeira ampliação do teste usou um seletor de label incompatível com textarea preenchido; corrigido para papel/nome acessível e suíte reaprovada.
- `npm run lint` sem avisos e `npm run build` aprovados. Auditorias backend e frontend: zero vulnerabilidades após atualizações compatíveis.
- Migração **aditiva** aplicada ao banco configurado somente após validação em PostgreSQL separado. Antes: schema `research` ausente e dez tabelas públicas. Depois: schema disponível, dez tabelas públicas preservadas e zero projetos/execuções da pesquisa.
- Smoke da aplicação real: health 200, projetos autenticados 200, sem sessão 401, rota antiga 404; inicialização do worker confirmada. Nenhum `.env`, senha ou chave foi alterado ou incluído nos commits.
- Pendências reais: executor isolado, geração de scripts compatíveis, coleta de evidências de testes e avaliação/revisão de divergências; OCR; métricas de qualidade com referência humana; quota/retencão global de artefatos e autenticação multiusuário. Nenhuma dessas funcionalidades é apresentada como operacional.

## Configuração administrativa

- Helper de configuração recebe senha somente por stdin, gera bcrypt e rejeita entrada acima de 72 bytes UTF-8; login também aplica esse limite para evitar truncamento silencioso do bcrypt.
- Validação manual com subprocesso: hash gerado confere com a senha sintética e entrada acima do limite é recusada. Suíte backend: 22 aprovações.

## Indicadores globais

- Dashboard usa contagens agregadas de todo o banco, sem confundir o limite de 500 itens do histórico global com o total de execuções.
- Agregação validada na integração PostgreSQL; backend com 22 testes aprovados; frontend build/lint aprovados.

## Limpeza da documentação e SQL legados

- A pedido do pesquisador, removidos os dois roteiros exclusivos do experimento com participantes e os oito scripts SQL antigos da raiz de `database`.
- Ajustadas as referências nos READMEs, arquitetura e diagnóstico. Os registros anteriores deste documento descrevem a situação antes dessa limpeza.
- Mantida a migração `database/migrations/009_research_foundation.sql`, sem renomear ou alterar seu conteúdo/checksum. Nenhuma tabela ou dado de banco foi excluído.
- Validação: nenhuma referência restante aos arquivos removidos; `git diff --check` aprovado; suíte backend com 14 testes aprovados e três integrações ignoradas por ausência de `TEST_DATABASE_URL`, sem chamadas ao Gemini.

## Continuação — inspeção técnica v2

- Árvore GitHub no SHA, até 24 arquivos/240 KiB/30 KiB por arquivo/profundidade 8; integridade de blobs Git e SHA-256, módulos internos Node/Maven, símbolos JS via AST e candidatos Java com alertas de Swing/SQL.
- Omissões e árvore truncada explícitas. Testes existentes identificados separadamente. Inspeções preservadas em artefatos privados e migração aditiva 010; somente metadados no banco.
- Acorn adicionado para análise estática de JavaScript, sem executar fontes. `npm audit`: zero vulnerabilidades. PostgreSQL isolado e suíte: 24 testes aprovados.

## Continuação — scripts do agente 2

- Migração 011 adiciona subetapa `automation`, scripts versionados, vínculo com caso/execução/tentativa e revisão humana com arquivos antes/depois preservados em artefatos.
- Geração usa requisitos/casos aprovados e fechamento técnico selecionado, sem mudar fontes. Contrato confere SHA, esperado, referências, símbolos e caminhos reservados; JS validado por AST e Java limitado a JDK/JUnit/fechamento local.
- Casos não automatizáveis precisam de justificativa; não são omitidos. Scripts não são executados durante geração, validação ou revisão.
- Testes específicos: quatro aprovações, incluindo persistência real, edição auditada, revisão obsoleta e bloqueio de aprovação antecipada. Suíte usa concorrência de arquivos 1, pois workers de teste compartilham a fila PostgreSQL; concorrência de claims continua exercitada explicitamente.

## Continuação — contrato e serviço executor

- Serviço separado sem dependências do banco/modelo, autenticação, recibo de isolamento, imagens imutáveis, verificação Git independente, comandos fixos Node/JDK/JUnit e journals limitados/idempotentes.
- Recursos/rede/UID/seccomp/cgroups verificados por probe confiável. Entradas copiadas para tmpfs com permissões sem escrita para testes; sem bind mounts/socket. Timeout/cancelamento passam por remoção do contêiner; falha de limpeza bloqueia serviço.
- `executor/npm test`: cinco testes aprovados usando Docker injetado; sintaxe do runner/servidor validada. Nenhum repositório ou teste gerado foi executado no host.
- Limitação: imagens/probe/piloto real não puderam ser validados no ambiente sem VM/daemon. A disponibilidade real continua bloqueada; detalhes de provisionamento em `executor/README.md`.

## Continuação — integração do agente 3

- Autorização independente após revisão dos scripts, com bundle imutável, hash, SHA, versões dos scripts e recibo de política/imagem persistidos. API/worker comunicam somente por HTTPS autenticado, sem credenciais do banco/Gemini no bundle.
- Migração 012 guarda trabalhos, evidências de origem executor e resultados individuais, incluindo falha de teste/compilação/infraestrutura, timeout, cancelamento e inconclusivo. Transporte/recibo inválido não produz evidência.
- Worker determinístico integra o serviço, monitora cancelamento/lease e não executa projeto no host. Trabalho remoto é idempotente; repetição de transporte usa mesmo UUID/hash.
- Suíte backend ampliada: 30 testes aprovados; integração específica confere bloqueio sem VM, autorização, rejeição de duplicação e rastreabilidade de resultado/evidência com executor injetado. Fixtures não são resultados reais da pesquisa.

## Continuação — avaliação do agente 4

- Migração 013 persiste avaliações vinculadas a requisito/caso/script/resultado. Agent 4 enfileirado somente após evidência independente; entrada inclui scripts, fontes, esperado, observações e ambiente.
- Contrato rejeita observações/citações inventadas, IDs alheios, omissões e classificações incompatíveis com estados técnicos. Infraestrutura/compilação/timeout não autorizam inferir divergência funcional; observação truncada exige inconclusivo.
- Decisão humana com justificativa/revisão fica separada do conteúdo original do modelo. Todos os findings precisam de revisão para concluir; rejeitar uma classificação não a confirma implicitamente.
- Testes específicos: três aprovações com PostgreSQL, cobrindo referências, matriz conservadora e reclassificação humana sem sobrescrever a proposta automática. JSON/CSV v2 incluem scripts, bundles, resultados, evidências, findings e versões humanas dos arquivos.

## Continuação — documentos extensos

- Migração 014 persiste partes e vínculo com cada chamada. Seleções acima de 24 mil caracteres usam segmentos de até 12 mil, orçamento de 16 mil por entrada e sobreposição de 600 caracteres, preservando documento/página/offsets e páginas vazias.
- Um claim processa uma parte; checkpoints concluídos sobrevivem à retomada. Até três sessões de tentativa da etapa, sem confundir quantidade de partes com limite de repetição. Cada chamada tem entrada/saída/metadados próprios.
- Consolidação determinística mescla somente conteúdo idêntico, preserva fontes e mapeia códigos locais para globais. Possíveis duplicidades com diferenças e contradições lexicais são alertas para revisão, não conclusões semânticas.
- Limite anterior de 100 mil removido: seleção até 4,1 milhões de caracteres, 512 partes, 2000 requisitos consolidados e teto de artefato de 12 MiB; limites de upload/extração por documento continuam explícitos.
- Três testes específicos aprovados: cobertura integral dos offsets/páginas, duplicidades/contradições e documento acima de 100 mil com falha/retomada sem repetir a primeira parte. Sem consumo Gemini.

## Continuação — interface integrada

- Quatro cartões lógicos mantidos; automação aparece como subetapa do agente 2. Inspeção detalha módulos, fontes/símbolos, omissões e links no SHA. Scripts têm código revisável, esperado, fontes e aprovação separada da autorização.
- Execução consulta capacidade real do serviço e bloqueia o botão sem recibo válido. Resultados, comandos, ambiente, stdout/stderr e relatórios são consultáveis. Avaliações exibem a cadeia requisito/caso/script/resultado e decisões humanas independentes.
- Partes de documentos exibem checkpoints, offsets e erros. Relatórios incluem toda a cadeia persistida.
- Build e lint aprovados. Playwright/Chromium: fluxo de cadastro até revisão da avaliação, incluindo inspeção/geração/aprovação de scripts, bloqueio inicial do executor, evidências e exportação conferida; modo móvel sem overflow. Resultado: um teste aprovado, sem créditos Gemini e somente fixtures em banco isolado. A rota que habilita o executor fictício existe exclusivamente no servidor E2E, nunca na aplicação real.

## Continuação — revisão do executor

- Timeout/cancelamento preservam stdout/stderr parciais e assinalam que comandos/eventos internos podem não ter sido recuperados. Falha de limpeza agora interrompe também a drenagem de trabalhos já enfileirados.
- Teste de regressão com duas tarefas comprova que a segunda não inicia após falha de limpeza da primeira; serviço recusa novas autorizações. Seis testes do executor aprovados, sem Docker real.

- Revisão adicional: probe exige que o usuário dos testes não consiga escrever em `/project`; Java exige JDK/JUnit funcionais e checksum do jar igual à política/build. Captura Docker preserva fronteiras UTF-8 dos logs. Probes reais continuam pendentes da VM dedicada.

## Continuação — geração real no piloto escolhido

- `npm run smoke:automation`: fonte pública real `jonschlinkert/is-number`, SHA `98e8ff1da1a89f93d1397a24d7413ed15421c139`, oráculo técnico sintético. Gemini gerou um script que passou no contrato/AST, sem casos omitidos ou avisos.
- Provedor informou 1900 tokens de entrada, 484 de saída, 2384 totais; custo não informado (`null`). Nenhum código gerado foi executado/compilado nem houve gravação de resultados experimentais.
- Piloto/procedimentos/controles documentados em `PILOTO_EXECUCAO.md`. Execução real permanece pendente da VM; testes com fixtures não satisfazem esse critério.

## Continuação — fechamento de módulos

- Revisão de monorepos: alvos pertencem ao manifesto mais próximo; escopos preservam manifestos ancestrais para manter semântica CJS/ESM. Limite técnico de 16 fontes/manifestos por bundle.
- Inspeção deixa de iniciar novas leituras após 30 s, com omissões explícitas; uma consulta já iniciada conserva seu timeout de 12 s. Testes de módulos aninhados e orçamento temporal aprovados.

## Continuação — verificação final e banco configurado

- Backend: **36 testes aprovados, zero falhas/ignorados**, com PostgreSQL separado em `tcc_test_research`. Inclui geração/revisão de scripts, executor injetado, avaliação, rastreabilidade e retomada de documentos extensos. Após ajustar metadados iniciais dos agentes v2, os seis testes do pipeline persistente também passaram.
- Serviço executor: seis testes aprovados com transporte Docker injetado; imagem, probes e piloto reais continuam pendentes. Nenhum projeto externo foi executado no host/backend.
- Frontend: lint/build aprovados e um E2E Chromium aprovado, incluindo revisão até avaliação, exportação e modo móvel. Fixtures permanecem em `tcc_test_browser`/artefatos temporários; não são dados experimentais.
- API e worker agora verificam todas as migrações/checksums antes de iniciar. Integração cobre ausência de migração e checksum divergente, com rollback no banco de teste.
- Aplicadas 010–014 ao banco configurado, sob transação. Antes/depois: zero projetos/execuções; dez tabelas no schema público preservadas. Depois: zero trabalhos/evidências de execução. Reaplicação não fez alterações; checksums conferidos.
- Smoke autenticado da aplicação: health, projetos, histórico, resumo e capacidades retornaram HTTP 200; consulta sem sessão retornou 401. Capacidade real de execução `ready=false`, por ausência de VM/executor configurado; avaliação desabilitada sem evidências. Worker iniciou corretamente com fila vazia, sem consumo Gemini.
- Documentação de arquitetura, modelo/fluxos Mermaid, operação, API, migrações, reprodução e piloto atualizada para distinguir implementação, validação com fixtures e validação real pendente. Arquivo local `atual.java` preservado, fora dos commits.
- Dez documentos conferidos, 21 links locais válidos e `git diff --check` sem erros. Cluster PostgreSQL temporário da suíte encerrado ao final; serviço/banco configurado da aplicação preservado.

### Commits por etapa desta continuação

| Etapa | Commits principais |
| --- | --- |
| Diagnóstico | `01b5ccc` |
| Inspeção no SHA e monorepos | `836ed19`, `be08bf4` |
| Scripts gerados/revisados | `02d9809` |
| Serviço executor e revisão dos controles | `7fabb9c`, `35e1afc`, `6c19130` |
| Agente 3 e persistência | `2bca391` |
| Agente 4 e revisão humana | `c9ffdbf` |
| Documentos extensos/checkpoints | `612cad1` |
| Interface e E2E integrado | `33f8343` |
| Geração real/piloto documentado | `95de535` |
| Inicialização/migrações e definições v2 | `f1053ee`, `7512965` |

O critério de execução real de ponta a ponta não foi atingido neste ambiente. Resta provisionar a VM, validar as imagens/probes/limpeza e executar os controles do piloto, conforme [PILOTO_EXECUCAO.md](PILOTO_EXECUCAO.md). A limitação permanece explícita na interface e não foi contornada com dados fictícios.

## Docker ligado — diagnóstico e execução técnica real

- Docker Desktop 4.43.1/Engine 28.3.0 acessível no contexto `desktop-linux`, kernel WSL2, cgroups v2 com driver `cgroupfs`, sem rootless. Somente a distribuição `docker-desktop` disponível; não foi encontrada VM dedicada acessível. Política do serviço permanece recusando esse ambiente.
- Imagem Node construída a partir da imagem oficial fixada em `node@sha256:fe4f6d74e20370acb04ad889077d14d0f64a9c8ea6a42bc60cddf1e844699914`, Node reportado v22.23.4. `.dockerignore` limita contexto aos runners/protocolo/imagens/jar provisionado, sem segredos ou dados da aplicação.
- Probe real aprovado em **14 controles**: UID, root read-only, proteção de escrita no projeto, capacidades, no-new-privileges, seccomp, CPU/memória/pids, rede, ausência de socket, tmpfs e ausência de variáveis secretas. Cada contêiner removido após execução.
- Descoberto e corrigido erro real não exercitado pelos mocks: `docker cp` falha com root read-only. Substituído por inicializador confiável de comando fixo que grava JSON validado no tmpfs e sela permissões antes dos testes. A raiz continua read-only; testes continuam sem privilégios. Entrada por linha JSON elimina dependência de EOF no attach e preserva UTF-8 entre chunks.
- Descoberta e corrigida classificação de importação ausente: Node antes emitia erro genérico do arquivo de teste. Entrada confiável agora preserva o erro original em eventos `node:test`, sem inferir status pelo stderr. Caminho selecionado registrado em `commands.test_file`; ausência de teste registrado não vira passagem.
- `smoke:runtime`: **dez cenários reais aprovados** usando somente fonte/controles sintéticos: passagem, asserção incorreta, erro no teste, dependência ausente, fontes protegidas, stdout que não vira resultado, skip, nenhum teste, timeout e cancelamento. Interrupções usam limite técnico de 1,5 s e verificam remoção. Relatório completo local em `.local/executor-runtime-check/runtime-smoke.json`, marcado `production_executor_validated=false`; sem gravação no banco de pesquisa.
- Suíte padrão do executor: **oito testes aprovados**, incluindo regressões de framing, volume e adulteração. Backend: **36 aprovados**, sem ignorados, em banco separado. Chromium E2E: **um aprovado** em 27,8 s, com fixtures e exportação completa. A primeira tentativa do navegador falhou antes de executar o fluxo por Chromium padrão ausente; foi repetida usando o Chromium instalado indicado em `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`.
- Commits: `f1f0fd6` corrige preparação/resultados reais; `0d3c38f` adiciona smoke reproduzível e restringe build. Java, serviço em VM dedicada, piloto público e avaliação Gemini sobre esse piloto continuam pendentes. Nenhum teste de repositório público foi executado nesta verificação.

## Perfil Docker Desktop autorizado e piloto público real

- O usuário escolheu explicitamente **Docker Desktop neste computador, para desenvolvimento**. Implementado perfil `docker-desktop-dev`, separado do padrão `dedicated-vm`. Exige Docker Desktop/Linux/cgroups v2/seccomp e os mesmos probes; é recusado em produção. HTTP autenticado somente em loopback literal; modo dedicado mantém HTTPS/VM/rootless/systemd.
- `npm run dev:local`, na raiz, constrói a imagem fixada, gera/reutiliza token e política privados em `.local/executor-dev` e inicia executor/API/worker/Vite. Não altera `.env`, não passa credenciais do backend ao serviço e recusa portas ocupadas. Inicialização, Ctrl+C e nova inicialização foram exercitados. Executor encerra por IPC e aborta trabalhos para limpeza.
- API autenticada respondeu com recibo real `ready=true`, perfil local, `development_only=true` e 14 controles aprovados. Resultados/exportações preservam perfil/runtime/imagem/política. Painel exibe perfil também depois da execução.
- Piloto `jonschlinkert/is-number`, SHA `98e8ff1da1a89f93d1397a24d7413ed15421c139`, execução `10a33dbc-8ea0-4f79-9bb4-da75a1482b84`: dois requisitos, dois casos, dois scripts Gemini reais, duas asserções realmente executadas/aprovadas, duas análises `compatible`, revisão técnica identificada e conclusão/exportação JSON v2/CSV. Fonte pública imutável, sem mocks da implementação ou descoberta da suíte anterior. Job `64099cc6-dfd1-4be8-a32f-4097405b772e`, runner 612 ms, exit code 0; contêiner removido.
- A primeira resposta Gemini do agente 4 copiou a descrição do requisito no lugar do esperado literal do caso. Contrato rejeitou e preservou a saída/tentativa; nenhum finding inválido foi salvo. Schema enviado ao provedor passou a restringir `expected_behavior` aos valores dos casos aprovados, conservando validação local por resultado/caso. Repetição explícita passou e a falha anterior continua exportada. Teste de regressão verifica enum sem contaminar os demais campos compartilhados do schema.
- Cinco chamadas Gemini reais, 12.938 tokens totais reportados; custo não informado (`null`). Oráculo sintético e revisões técnicas do assistente identificados nas justificativas; não alegam julgamento humano independente da pesquisa. Dados do piloto permanecem no banco configurado/histórico; fixtures permanecem em bancos separados.
- Backend: **38 testes aprovados**, zero falhas/ignorados. Executor: **nove aprovados**, incluindo perfis e recusa em produção. Frontend lint/build aprovados; E2E Chromium completo com fixtures aprovado em 27,2 s. Consulta adicional no navegador à aplicação real confirmou dois resultados, perfil local visível e zero erros JavaScript; captura em `.local/desktop-pilot/execution.png`.
- Exportações/resumo locais: `.local/desktop-pilot/export.json`, `.csv` e `summary.json`. Conferida ausência do token do executor no JSON. Sem contêineres de teste remanescentes. Os registros anteriores de bloqueio neste documento são históricos e precedem a escolha explícita pelo perfil local.
- Commits desta etapa: `4bb2278` (perfil local e rastreabilidade), `9f18d22` (comando único), `867c4b8` (schema de avaliação). Java, VM dedicada e controles acadêmicos adicionais continuam pendentes, conforme [piloto](PILOTO_EXECUCAO.md).

## 30/10/2026 — Recuperação da análise documental do VVV

- Falha real no agente 1 ao processar `analise_requisitos_vvv.pdf`: 93 páginas, 92.838 caracteres. Quatro checkpoints válidos; falhas posteriores por resposta `MAX_TOKENS` e citações reescritas/abreviadas pelo modelo, recusadas pela validação literal. Não era uma falha de execução Docker do código Java.
- Agente 1 v1.1 usa IDs de trechos literais; o servidor resolve as fontes deterministicamente e conserva a resposta bruta. Entradas extensas passam a usar segmentos de 6000, orçamento de 8000 mais sobreposição de 600 e limite de 40 fragmentos por grupo. O processamento por partes também é acionado por mais de 40 páginas. A validação de grounding permanece obrigatória.
- Migração 015 aplicada de forma aditiva ao banco configurado. Continuação cria nova análise vinculada ao snapshot original, valida/reutiliza checkpoints e redivide apenas as partes restantes. Limite de sessões e tentativas anteriores permanece preservado; exportação inclui os artefatos/metadados reaproveitados separadamente.
- Análise original `cdbacc6d-dbe9-4052-a79b-4b72e9f6a5dc`, continuação `cc0ff729-5170-4395-966f-ec67c2cf2ebc`: **9/9 partes concluídas, quatro reaproveitadas, cinco chamadas novas concluídas sem repetição, 78 requisitos gerados**. Novas chamadas reportaram 39.352 tokens; custo não informado (`null`). As sete chamadas anteriores, inclusive falhas, continuam no histórico. A análise original foi posteriormente cancelada pelo painel; esse registro foi preservado.
- A continuação chegou a `awaiting_review`. Na conferência final, havia uma aprovação e 77 requisitos pendentes registrados no painel. O assistente não aprovou requisitos do VVV nem autorizou geração de casos/scripts ou execução Java. Os 78 conteúdos passaram na validação contra os documentos preservados; isso não comprova correção semântica ou cobertura.
- Backend: **41 testes aprovados**, sem falhas/ignorados, em banco de teste separado. Incluem resolução literal/Unicode/IDs inválidos, saída bruta preservada, retomada após limite de sessões, snapshot original e exportação dos checkpoints. Frontend lint/build e E2E Chromium completo com fixtures aprovados. A inclusão dos links entre análises foi conferida novamente nos dois testes de integração pertinentes e no lint/build.
- Navegador conectado à aplicação real confirmou os 78 itens, links nos dois sentidos e zero erros JavaScript. JSON v2/CSV exportados e conferidos com entradas/saídas/tentativas reaproveitadas resolvidas. Evidências privadas em `.local/vvv-recovery/{export.json,export.csv,summary.json,browser.json,requirements.png}`, ignoradas pelo Git.
- Commits: `9141171` (fontes/checkpoints), `87d44c4` (continuação no painel), `0411f79` (links de histórico). API, worker, executor e frontend reiniciados com a atualização pelo launcher local; o banco e os documentos originais foram preservados. Esta validação cobre análise documental do VVV, sem alegar execução dos seus testes Java/Swing/banco.
