# Requisita — Plataforma Multiagente de Análise de Requisitos e Testes

Base funcional do TCC **“Análise de Requisitos e Testes de Software com Inteligência Artificial Generativa: Uma Abordagem Multiagente”**.

A aplicação existente foi evoluída mantendo React/Vite/Tailwind/Router, Express, PostgreSQL, autenticação administrativa e Gemini (`@google/genai`). O fluxo ativo é utilizado pelo pesquisador; participantes, grupos e questionários pertencem ao histórico preservado.

## Funcionalidades disponíveis

- Cadastro/edição de projetos públicos do GitHub, com branch/tag/commit resolvido para SHA e versões de código preservadas.
- Upload versionado de PDF/TXT/MD, download do original, extração textual por página e avisos sobre limitações.
- Agente de requisitos com contrato estruturado, citações conferidas e revisão/correção humana auditável.
- Agente de casos de teste textuais, a partir de requisitos aprovados, com vínculos persistidos e revisão.
- Worker assíncrono, estados por agente, prevenção de duplicação, até três tentativas e recuperação de interrupções.
- Histórico, entradas/saídas, parâmetros, instruções versionadas, tokens informados pelo provedor e exportação JSON/CSV.

**Execução de código externo e avaliação de divergências estão desabilitadas.** O adaptador inicial apenas inspeciona manifestos no SHA e identifica candidatos Node; não executa comandos. Sem infraestrutura isolada validada, não são produzidos resultados de testes nem defeitos fictícios.

## Requisitos de desenvolvimento

Node.js 20.19+ (validado com 20.20; prefira uma versão LTS suportada), npm, PostgreSQL 17+ e acesso HTTPS ao GitHub/Gemini. Docker não é necessário para esta base. Backend e worker precisam compartilhar banco e diretório de artefatos.

## Instalação

No diretório do repositório, em PowerShell:

```powershell
cd backend
npm ci
if (!(Test-Path .env)) { Copy-Item .env.example .env }
cd ../frontend
npm ci
if (!(Test-Path .env)) { Copy-Item .env.example .env }
```

Copie os exemplos somente se o arquivo `.env` ainda não existir. Preserve credenciais/configurações preexistentes. Esses arquivos não devem ser versionados.

Crie um banco dedicado, por exemplo com as ferramentas do PostgreSQL no PATH:

```powershell
createdb -h localhost -U postgres tcc_research
```

Ajuste `backend/.env`:

```dotenv
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=tcc_research
DB_USER=postgres
DB_PASSWORD=preencha_localmente
DB_SSL=false
FRONTEND_URL=http://localhost:5173
GEMINI_API_KEY=preencha_localmente
GEMINI_MODEL=identificador_do_modelo_disponivel_na_sua_conta
AUTH_SECRET=segredo_aleatorio_longo
ADMIN_EMAIL=seu_email
ADMIN_PASSWORD_HASH=hash_bcrypt_da_senha
# ARTIFACTS_DIR=C:/dados/tcc/artifacts
```

Banco remoto: `DB_SSL=true`, com certificado válido. `AUTH_SECRET` pode ser gerado com `node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"`. Não compartilhe o resultado.

Para gerar o hash sem colocar a senha nos argumentos ou histórico do terminal, dentro de `backend`:

```powershell
$adminPassword = Read-Host 'Senha administrativa (mínimo 12 caracteres)' -AsSecureString
[System.Net.NetworkCredential]::new('', $adminPassword).Password | node scripts/hash-password.js
Remove-Variable adminPassword
```

Use pelo menos 12 caracteres e no máximo 72 bytes UTF-8 (limite do bcrypt). Copie somente o hash emitido para `ADMIN_PASSWORD_HASH`. Em `frontend/.env`, configure:

```dotenv
VITE_API_URL=http://localhost:3000/api
```

Use o mesmo hostname (`localhost`) para interface e API no desenvolvimento, mantendo cookies e a origem configurada. Em produção use HTTPS e `NODE_ENV=production`.

## Banco e processos

Dentro de `backend`:

```powershell
npm run migrate
npm start
```

Em outro terminal, também dentro de `backend`:

```powershell
npm run worker
```

Em um terceiro terminal, dentro de `frontend`:

```powershell
npm run dev
```

Acesse **http://localhost:5173**, faça login administrativo e cadastre um projeto. Sem worker ativo, uma análise permanece pendente; a API não executa inferências na requisição.

As migrações em `database/migrations` são transacionais, têm checksum e podem ser reexecutadas. **Não rode novamente os scripts históricos 001–008 em bancos existentes.** Novo banco também usa apenas `npm run migrate`. O schema novo `research` não remove nem transforma dados antigos. A API informa quando o schema ainda não foi aplicado.

Os artefatos ficam por padrão em `backend/artifacts`, fora dos arquivos públicos. Configure um diretório absoluto compartilhado para API/worker em ambientes separados. Faça backup do banco **e** desse diretório. A base não tem política automática de retenção ou quota global de disco.

## Primeiro processamento

1. Cadastre o projeto e confira o SHA retornado pelo GitHub.
2. Adicione PDF com camada textual e confira a extração/avisos; complemente lacunas por texto.
3. Selecione documentos e versão de código e inicie a análise.
4. Confira fontes e conteúdo de cada requisito, registre justificativa e aprove/rejeite todos.
5. Autorize a geração de casos; confira passos, esperado e requisitos relacionados, revisando cada caso.
6. Conclua a geração textual e exporte o JSON/CSV em Relatórios ou Histórico.

Uma nova análise cria outra execução. Edições no projeto e novos documentos não alteram os snapshots anteriores. “Concluída” significa conclusão da geração/revisão textual; os agentes de execução e avaliação continuam explicitamente não suportados.

## Testes

Backend, sem créditos de IA:

```powershell
cd backend
npm test
```

Integração requer **banco separado** com nome começando por `tcc_test_`:

```powershell
createdb -h localhost -U postgres tcc_test_research
$env:TEST_DATABASE_URL='postgresql://usuario:senha@localhost:5432/tcc_test_research'
npm run test:integration
```

Sem essa variável, integrações são indicadas como ignoradas. Nunca aponte para o banco da pesquisa; as fixtures persistem somente no banco de teste. Os diretórios de artefatos usados pela suíte são temporários.

Frontend:

```powershell
cd frontend
npm run lint
npm run build
npx playwright install chromium
$env:TEST_DATABASE_URL='postgresql://usuario:senha@localhost:5432/tcc_test_browser'
npm run test:e2e
```

Crie antes `tcc_test_browser` com `createdb`. O Playwright inicia Vite/API de teste nas portas 5178/3101, usa PostgreSQL real e respostas GitHub/Gemini injetadas e identificadas como fixtures. Verifica cadastro, importação, correção/revisão, rastreabilidade exportada e viewport móvel. Não acessa o modelo pago. Opcionalmente indique um Chromium já instalado por `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`.

Validação **manual e paga** dos dois contratos com o Gemini configurado (texto sintético, sem gravação de resultados da pesquisa):

```powershell
cd backend
npm run smoke:gemini
```

## Documentação

- [Diagnóstico e decisões](docs/PLANO_EVOLUCAO.md).
- [Arquitetura, entidades, estados, segurança e limitações](docs/ARQUITETURA_PESQUISA.md).
- [Procedimento de repetição e critérios de avaliação](docs/PROTOCOLO_REPRODUCAO.md).
- [Validações realizadas e resultados técnicos](docs/VALIDACAO.md).
- [API e operação](backend/README.md), [banco](database/README.md) e [frontend](frontend/README.md).

Os antigos `docs/SMOKE_TEST.md` e `docs/EXPERIMENT_CHECKLIST.md` documentam exclusivamente o experimento encerrado; não são o procedimento vigente.
