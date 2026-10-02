# Database

Scripts de banco de dados da aplicação desenvolvida para o TCC.

Banco utilizado: **PostgreSQL**.

## Arquivos

### `001_schema.sql`

Cria a estrutura inicial do banco de dados, incluindo tabelas, tipos, constraints e índices utilizados no experimento.

## Execução

```bash
psql -U postgres -d nome_do_banco -f database/001_schema.sql
```

## Observação

Novos scripts serão adicionados conforme a evolução do projeto.