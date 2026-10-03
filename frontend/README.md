# Frontend

Interface web do experimento de geracao de casos de teste com IA generativa.

## Tecnologias

- React
- Vite
- JavaScript
- React Router DOM
- Axios
- Tailwind CSS

## Instalacao

```bash
npm install
```

## Configuracao

Crie o arquivo `.env` a partir do exemplo:

```powershell
Copy-Item .env.example .env
```

Variavel esperada:

```env
VITE_API_URL=http://localhost:3000/api
```

## Desenvolvimento

```bash
npm run dev
```

## Build

```bash
npm run build
```

## Fluxos disponiveis

- Identificacao do participante.
- Consentimento e questionario de perfil.
- Execucao das tres atividades do experimento na ordem configurada pelo grupo.
- Atividade manual com cadastro, edicao e exclusao de casos de teste.
- Atividades com IA para prompt simples e prompt estruturado.
- Area administrativa em `/admin` com visao geral, participantes, atividades e exportacoes JSON/CSV.

## Atencao

A rota `/admin` ainda nao possui autenticacao. Use somente em ambiente controlado durante a preparacao e execucao do experimento.
