# TCC - Geracao de Casos de Teste com IA Generativa

Projeto desenvolvido como parte de um Trabalho de Conclusao de Curso em Sistemas de Informacao.

O objetivo e apoiar a execucao de um experimento sobre geracao de casos de teste a partir de casos de uso, comparando:

- modo manual;
- IA com prompt simples;
- IA com prompt estruturado.

## Estrutura

```text
.
|-- backend/
|-- database/
|-- docs/
|-- frontend/
`-- README.md
```

## Tecnologias

- PostgreSQL
- Node.js
- Express
- React
- Vite
- Gemini API

## Configuracao inicial

1. Crie o banco PostgreSQL.
2. Execute os scripts da pasta `database/` na ordem numerica.
3. Configure `backend/.env` com base em `backend/.env.example`.
4. Configure `frontend/.env` com base em `frontend/.env.example`.
5. Instale as dependencias do backend e do frontend.

## Backend

```bash
cd backend
npm install
npm run dev
```

API local: `http://localhost:3000/api`

## Frontend

```bash
cd frontend
npm install
npm run dev
```

## Fluxo experimental

Cada participante e associado a um grupo experimental. Ao iniciar o experimento, o backend cria tres atividades na ordem definida para o grupo:

- uma atividade manual;
- uma atividade com prompt simples;
- uma atividade com prompt estruturado.

A proxima atividade so fica disponivel apos a conclusao da atividade anterior.

## Area administrativa

A area administrativa fica em `/admin` e permite acompanhar progresso, consultar atividades e exportar dados em JSON/CSV.

Atencao: `/admin` ainda nao possui autenticacao. Use somente em ambiente controlado.

## Documentacao operacional

- `docs/EXPERIMENT_CHECKLIST.md`
- `docs/SMOKE_TEST.md`
