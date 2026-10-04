# Backend

API do projeto de TCC sobre geracao de casos de teste com IA generativa.

## Tecnologias

- Node.js
- Express
- PostgreSQL com `pg`
- dotenv
- CORS
- Gemini API via `@google/genai`

## Instalacao

```bash
npm install
```

## Configuracao

Crie o arquivo `.env` a partir do exemplo:

```powershell
Copy-Item .env.example .env
```

Variaveis esperadas:

```env
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=tcc_test_generation
DB_USER=postgres
DB_PASSWORD=
DB_SSL=false
GEMINI_API_KEY=
GEMINI_MODEL=
```

Use `DB_SSL=true` para bancos PostgreSQL remotos que exigem SSL. Quando `DB_SSL` nao for informado, o backend desativa SSL para `localhost`/`127.0.0.1` e ativa SSL para outros hosts.

Antes de iniciar, execute os scripts SQL da pasta `../database` no PostgreSQL, na ordem numerica.

## Desenvolvimento

```bash
npm run dev
```

## Producao local

```bash
npm start
```

A API fica disponivel em `http://localhost:3000/api`.

## Rotas principais

- `GET /api/health`
- `GET /api/use-cases`
- `POST /api/participants`
- `GET /api/participants/:id/experiment-tasks/next`
- `PATCH /api/experiment-tasks/:id/start`
- `POST /api/experiment-tasks/:id/prompt/preview`
- `POST /api/experiment-tasks/:id/generate`
- `PATCH /api/experiment-tasks/:id/complete`
- `GET /api/admin/export/json`
- `GET /api/admin/export/csv`
- `GET /api/admin/export/xlsx`

## Fluxo de IA

Os modos `SIMPLE_PROMPT` e `STRUCTURED_PROMPT` recebem `participant_input`.
O backend monta o prompt final usando o template ativo, adiciona o caso de uso e
salva em `ai_runs`:

- `participant_input`
- `final_prompt`
- versao do template
- modelo
- tempo de resposta
- resposta bruta da IA
