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
- Atividade com prompt simples em que o participante escreve uma instrucao livre.
- Atividade com prompt estruturado em que o participante preenche um formulario.
- Pre-visualizacao do prompt final antes do envio para IA.
- Confirmacao de envio unico para Gemini, sem regeneracao.
- Area administrativa em `/admin` com visao geral, participantes, atividades, rastreabilidade dos prompts e exportacoes JSON/CSV/Excel.

## Atencao

A rota `/admin` ainda nao possui autenticacao. Use somente em ambiente controlado durante a preparacao e execucao do experimento.
