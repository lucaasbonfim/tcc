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
