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

- Login do participante com e-mail e codigo de acesso.
- Consentimento e questionario de perfil.
- Execucao das tres atividades do experimento na ordem configurada pelo grupo.
- Atividade manual com cadastro, edicao e exclusao de casos de teste.
- Atividade com prompt simples em que o participante escreve uma instrucao livre.
- Atividade com prompt estruturado em que o participante preenche um formulario.
- Pre-visualizacao do prompt final antes do envio para IA.
- Confirmacao de envio unico para Gemini, sem regeneracao.
- Login administrativo em `/admin/login`.
- Area administrativa em `/admin` com cadastro de participantes por e-mail, reenvio de acesso, visao geral, participantes, atividades, rastreabilidade dos prompts e exportacoes JSON/CSV/Excel.

## Pseudonimizacao

O e-mail e usado somente para controle de acesso. As telas e exportacoes de
analise experimental continuam usando o codigo pseudonimizado do participante,
como `P01` ou `P02`.
