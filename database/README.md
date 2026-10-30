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

API e worker recusam iniciar com migração pendente ou checksum divergente. A atualização não remove tabelas/dados históricos. Evidências e resultados possuem FKs para a cadeia da execução; não há importação manual de evidências pelo painel.

Os scripts do experimento anterior foram removidos do repositório e permanecem consultáveis no histórico do Git. A numeração da migração atual foi mantida para preservar os registros e checksums de ambientes já inicializados. Nenhuma tabela existente é apagada ou convertida pela remoção desses arquivos.

As entidades efetivamente criadas, FKs e diagrama estão em [Arquitetura](../docs/ARQUITETURA_PESQUISA.md). Documentos e respostas grandes ficam em armazenamento privado de artefatos; suas referências e hashes ficam no PostgreSQL. Backup somente do banco não preserva os PDFs/extrações/entradas/saídas.

Testes de integração exigem `TEST_DATABASE_URL` e nome de banco com prefixo `tcc_test_`. O runner de testes jamais deve apontar para o banco da pesquisa. Fixtures permanecem nesse banco separado; artefatos da suíte são temporários. Crie novo banco de teste para uma execução totalmente vazia.
