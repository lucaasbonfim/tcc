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
