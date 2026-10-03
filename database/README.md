# Database

Scripts PostgreSQL usados pelo experimento.

## Arquivos

- `001_schema.sql`: cria tipos, tabelas, constraints e indices.
- `002_seed.sql`: cadastra grupos experimentais, casos de uso A/B/C e distribuicao das atividades.
- `003_seed_prompts.sql`: cadastra o prompt simples.
- `004_seed_prompt_estruturado.sql`: cadastra o prompt estruturado.
- `005_alter_ai_runs_participant_prompt.sql`: adiciona entrada do participante e prompt final em `ai_runs`.
- `006_seed_prompt_templates_v2.sql`: cadastra templates participativos versao `2.0`.

## Ordem de execucao

Execute os scripts na ordem numerica:

```bash
psql -U postgres -d tcc_test_generation -f database/001_schema.sql
psql -U postgres -d tcc_test_generation -f database/002_seed.sql
psql -U postgres -d tcc_test_generation -f database/003_seed_prompts.sql
psql -U postgres -d tcc_test_generation -f database/004_seed_prompt_estruturado.sql
psql -U postgres -d tcc_test_generation -f database/005_alter_ai_runs_participant_prompt.sql
psql -U postgres -d tcc_test_generation -f database/006_seed_prompt_templates_v2.sql
```

## Observacoes

- O script `002_seed.sql` pode ser reexecutado sem duplicar grupos, casos de uso ou atividades por grupo.
- Os scripts de prompt atualizam a versao `1.0` quando executados novamente.
- O script `006_seed_prompt_templates_v2.sql` atualiza a versao `2.0` dos templates participativos.
- Antes da coleta, confirme que `GET /api/use-cases` retorna os casos A, B e C.
