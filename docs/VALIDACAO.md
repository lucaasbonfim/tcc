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
