# Requisita — Plataforma Multiagente de Análise de Requisitos e Testes

Base funcional do TCC **“Análise de Requisitos e Testes de Software com Inteligência Artificial Generativa: Uma Abordagem Multiagente”**.

A aplicação existente foi evoluída mantendo React/Vite/Tailwind/Router, Express, PostgreSQL, autenticação administrativa e Gemini (`@google/genai`). O fluxo ativo é utilizado pelo pesquisador; participantes, grupos e questionários pertencem ao histórico preservado.

## Desenvolvimento com Docker Desktop

Com dependências e `backend/.env` já configurados, ligue o Docker Desktop e execute **na raiz**:

```powershell
npm run dev:local
```

Abra **http://localhost:5173**. O comando prepara a imagem, valida o perfil local e inicia executor, API, worker e frontend. Ctrl+C encerra os processos. Não precisa criar VM ou editar tokens do executor; seus `.env` são preservados. [Instruções e solução de problemas](docs/DESENVOLVIMENTO_LOCAL.md).

## Funcionalidades disponíveis

- Cadastro/edição de projetos públicos do GitHub, com branch/tag/commit resolvido para SHA e versões de código preservadas.
- Upload versionado de PDF/TXT/MD, download do original, extração textual por página e avisos sobre limitações.
- Agente de requisitos com contrato estruturado, citações conferidas e revisão/correção humana auditável.
- Agente de casos de teste textuais, a partir de requisitos aprovados, com vínculos persistidos e revisão.
- Worker assíncrono, estados por agente, prevenção de duplicação, até três tentativas e recuperação de interrupções.
- Histórico, entradas/saídas, parâmetros, instruções versionadas, tokens informados pelo provedor e exportação JSON/CSV.
- Inspeção de módulos/fontes no SHA e geração de scripts Node/JUnit a partir de casos aprovados, com revisão de código e versões preservadas.
- Processamento incremental de documentos extensos com checkpoints, referências por página e consolidação auditável.
- Integração dos agentes 3 e 4 com serviço executor independente, evidências e revisão de classificações.

**Há dois perfis de execução:** desenvolvimento local com Docker Desktop, ativado explicitamente pelo comando acima, e ambiente dedicado com VM/rootless/TLS, padrão dos serviços iniciados manualmente. Ambos exigem imagens fixadas, controles verificados e autorização dos scripts. Resultados registram o perfil efetivamente usado. Java ainda exige provisionamento adicional; fixtures técnicas não são resultados da pesquisa.

## Requisitos de desenvolvimento

Node.js 20.19+ para API/frontend/controle local (validado com 20.20), npm, PostgreSQL 17+ e acesso HTTPS ao GitHub/Gemini. Backend e worker compartilham banco/diretório de artefatos. A imagem Node de testes usa Node 22. No perfil dedicado, o executor fica em VM separada com Docker rootless/cgroups e imagens provisionadas. Ele não é necessário para análise/geração/revisão.

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

As migrações em `database/migrations` são transacionais, têm checksum e podem ser reexecutadas. Bancos novos e existentes usam apenas `npm run migrate`. O schema novo `research` não remove nem transforma dados antigos. A API informa quando o schema ainda não foi aplicado.

Os artefatos ficam por padrão em `backend/artifacts`, fora dos arquivos públicos. Configure um diretório absoluto compartilhado para API/worker em ambientes separados. Faça backup do banco **e** desse diretório. A base não tem política automática de retenção ou quota global de disco.

## Primeiro processamento

1. Cadastre o projeto e confira o SHA retornado pelo GitHub.
2. Adicione PDF com camada textual e confira a extração/avisos; complemente lacunas por texto.
3. Selecione documentos e versão de código e inicie a análise.
4. Confira fontes e conteúdo; use **Corrigir conteúdo → Salvar correção** quando necessário. Clique em **Aprovar todos e gerar casos de teste** no início da lista. Itens rejeitados ficam excluídos.
5. Confira os casos gerados, passos, esperado e requisitos relacionados; salve as correções necessárias e clique em **Aprovar todos e continuar** para abrir Scripts.
6. Exporte o JSON/CSV em Relatórios ou Histórico. Não é necessário aprovar cada requisito/caso individualmente; observações de correção/aprovação são opcionais no painel, e a ação fica registrada no histórico.

Para continuar: na aba **Scripts**, inspecione fontes do mesmo SHA, escolha módulo/alvos/casos aprovados, gere os testes e revise seu código/esperado. Conclua a revisão; a aba **Execução** exige justificativa e disponibilidade verificada do serviço. Após resultados independentes, o agente 4 propõe análises para confirmação/rejeição/inconclusiva, com justificativa. Exportações v2 incluem scripts, bundles, resultados, evidências e revisões.

Uma nova análise cria outra execução. Edições no projeto/documentos não alteram snapshots anteriores. Confira o estado de cada agente: uma execução pode estar concluída somente no fluxo textual ou de scripts, sem testes executados. Após autorização, os agentes 3/4 registram seus estados e evidências reais separadamente.

Seleções acima de 24 mil caracteres ou 40 páginas são divididas em partes: segmentos de até 6000 caracteres, orçamento de 8000 e sobreposição de 600. O modelo referencia IDs de trechos; o servidor recupera as citações literais do documento. O limite de seleção é de 4,1 milhões de caracteres, até 512 partes/2000 requisitos e 12 MiB por artefato. Upload/extração por documento conservam seus limites; páginas vazias/diagramas exigem conferência. Duplicidades/contradições sinalizadas precisam de revisão humana.

Se a análise de requisitos falhar com partes já concluídas, **Continuar a partir dos checkpoints** cria uma análise vinculada, mantendo documentos/SHA originais e reaproveitando os checkpoints válidos sem novas chamadas. Apenas as partes restantes são redivididas e processadas. A análise anterior, suas tentativas e erros permanecem consultáveis pelos links entre as análises.

## Serviço executor (implantação separada)

Para desenvolvimento neste PC, use o comando local acima. Para o **perfil dedicado**, siga [executor/README.md](executor/README.md) na VM. Não inicie projetos ou testes gerados diretamente no host/backend. Após provisionar imagens, passar pelos probes e validar o piloto, configure **na API e no worker**:

```dotenv
EXECUTOR_URL=https://executor.administrativo.exemplo
EXECUTOR_TOKEN=segredo_compartilhado_de_transporte
EXECUTOR_DEPLOYMENT_ID=identificador_da_VM
EXECUTOR_POLICY_SHA256=hash_da_politica_validada
```

O backend verifica HTTPS, identidade, política, validade e imagens do recibo. Sem essa configuração/validação, a interface informa a indisponibilidade. Não há npm install, execução de scripts npm/Maven ou acesso à internet dentro dos testes. Node é o primeiro adaptador; Java/JUnit é inicial e limitado a classes JDK/locais sem Swing/banco. Veja [piloto e controles](docs/PILOTO_EXECUCAO.md).

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

Validação **manual e paga** dos contratos com o Gemini configurado (texto sintético, sem gravação de resultados da pesquisa):

```powershell
cd backend
npm run smoke:gemini
npm run smoke:automation
```

O segundo comando inspeciona fonte pública e valida geração real de um script Node com oráculo técnico sintético, **sem executar código nem gravar resultados experimentais**. Testes padrão do serviço executor, sem Docker/projetos externos, ficam em `executor`: `npm test`. O diagnóstico opcional `npm run smoke:runtime` executa somente fixtures conhecidas em Docker real, conforme [instruções do executor](executor/README.md), sem liberar o serviço para projetos externos.

## Documentação

- [Diagnóstico e decisões](docs/PLANO_EVOLUCAO.md).
- [Arquitetura, entidades, estados, segurança e limitações](docs/ARQUITETURA_PESQUISA.md).
- [Procedimento de repetição e critérios de avaliação](docs/PROTOCOLO_REPRODUCAO.md).
- [Validações realizadas e resultados técnicos](docs/VALIDACAO.md).
- [Evolução dos agentes 3/4](docs/EVOLUCAO_EXECUCAO.md) e [piloto de execução](docs/PILOTO_EXECUCAO.md).
- [Rodar com Docker Desktop neste computador](docs/DESENVOLVIMENTO_LOCAL.md).
- [API e operação](backend/README.md), [banco](database/README.md) e [frontend](frontend/README.md).

Documentos e scripts SQL exclusivos do experimento encerrado foram removidos. Suas versões anteriores permanecem disponíveis no histórico do Git.
