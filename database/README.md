# Banco PostgreSQL

A plataforma atual utiliza exclusivamente o schema `research`, definido em `migrations/009_research_foundation.sql`. Execute dentro de `backend`:

```powershell
npm run migrate
```

O runner aplica somente arquivos em `database/migrations`, sob transação e advisory lock. Registra nome, checksum SHA-256 (normalizando CRLF/LF) e data em `research.migrations`. Reexecutar não reaplica migrações; alterar um arquivo já aplicado provoca erro. Acrescente novas migrações para evoluir ambientes existentes.

Os arquivos **001–008 na raiz são históricos**, representam o antigo experimento e não são necessários para um banco novo. Não os altere nem reaplique automaticamente. Nenhuma tabela antiga é apagada ou migrada para requisitos artificialmente; dados de participantes não são dados da nova pesquisa.

As entidades efetivamente criadas, FKs e diagrama estão em [Arquitetura](../docs/ARQUITETURA_PESQUISA.md). Documentos e respostas grandes ficam em armazenamento privado de artefatos; suas referências e hashes ficam no PostgreSQL. Backup somente do banco não preserva os PDFs/extrações/entradas/saídas.

Testes de integração exigem `TEST_DATABASE_URL` e nome de banco com prefixo `tcc_test_`. O runner de testes jamais deve apontar para o banco da pesquisa. Fixtures permanecem nesse banco separado; artefatos da suíte são temporários. Crie novo banco de teste para uma execução totalmente vazia.
