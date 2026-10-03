# Database

Scripts PostgreSQL usados pelo experimento.

## Arquivos

- `001_schema.sql`: cria tipos, tabelas, constraints e indices.
- `002_seed.sql`: cadastra grupos experimentais, casos de uso A/B/C e distribuicao das atividades.
- `003_seed_prompts.sql`: cadastra o prompt simples.
- `004_seed_prompt_estruturado.sql`: cadastra o prompt estruturado.

## Ordem de execucao

Execute os scripts na ordem numerica:

```bash
psql -U postgres -d tcc_test_generation -f database/001_schema.sql
psql -U postgres -d tcc_test_generation -f database/002_seed.sql
psql -U postgres -d tcc_test_generation -f database/003_seed_prompts.sql
psql -U postgres -d tcc_test_generation -f database/004_seed_prompt_estruturado.sql
```

## Observacoes

- O script `002_seed.sql` pode ser reexecutado sem duplicar grupos, casos de uso ou atividades por grupo.
- Os scripts de prompt atualizam a versao `1.0` quando executados novamente.
- Antes da coleta, confirme que `GET /api/use-cases` retorna os casos A, B e C.
