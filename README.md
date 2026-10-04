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

O administrador acessa `/admin/login`, cadastra o e-mail do participante e o
backend cria automaticamente:

- codigo experimental pseudonimizado, como `P01`;
- grupo experimental balanceado entre Grupo 1, Grupo 2 e Grupo 3;
- codigo secreto de acesso enviado por e-mail.

O participante acessa a aplicacao com e-mail e codigo de acesso. O e-mail e
usado somente para controle de acesso e envio do codigo. Os dados experimentais
continuam associados ao codigo `P01`, `P02`, `P03` etc.

Cada participante e associado a um grupo experimental. Ao iniciar o experimento, o backend cria tres atividades na ordem definida para o grupo:

- uma atividade manual;
- uma atividade com prompt simples;
- uma atividade com prompt estruturado.

A proxima atividade so fica disponivel apos a conclusao da atividade anterior.

No modo manual, o participante cria os casos de teste diretamente. No modo de
prompt simples, o participante escreve uma instrucao livre e a aplicacao
adiciona automaticamente o caso de uso. No modo de prompt estruturado, o
participante preenche um formulario e a aplicacao monta o prompt final a partir
do template ativo.

Nos dois modos com IA, o participante visualiza o prompt final antes do envio,
pode voltar para editar sua entrada e confirma uma unica chamada ao Gemini. Apos
o envio, nao ha regeneracao nem edicao da resposta.

## Area administrativa

A area administrativa fica em `/admin`, exige autenticacao e permite cadastrar participantes por e-mail, reenviar acesso, acompanhar progresso, consultar atividades, visualizar rastreabilidade dos prompts e exportar dados em JSON/CSV/Excel.

As exportacoes academicas nao incluem e-mail, hash de codigo, tentativas de login ou dados de autenticacao.

## Documentacao operacional

- `docs/EXPERIMENT_CHECKLIST.md`
- `docs/SMOKE_TEST.md`
