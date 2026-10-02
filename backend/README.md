# Backend

Base inicial da API do TCC sobre geração de casos de teste com IA generativa.

## Tecnologias

- Node.js com ES Modules
- Express
- PostgreSQL com `pg`
- dotenv
- CORS

## Instalação

```bash
npm install
```

## Configuração

Crie o arquivo `.env` a partir do `.env.example` e ajuste as credenciais do PostgreSQL:

```powershell
Copy-Item .env.example .env
```

O banco e as tabelas devem estar criados conforme o script `../database/001_schema.sql`.

## Desenvolvimento

```bash
npm run dev
```

A API será disponibilizada em `http://localhost:3000/api`.
