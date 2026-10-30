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
