# Rodar neste computador com Docker Desktop

Com Docker Desktop ligado em modo de contêineres Linux, execute **na raiz do projeto**:

```powershell
npm run dev:local
```

Abra **http://localhost:5173** e use seu login administrativo. Mantenha o terminal aberto; **Ctrl+C** encerra frontend, API, worker e executor. Se o Windows perguntar sobre finalizar o arquivo em lotes, responda `S`.

O comando prepara a imagem Node, cria token/política locais, valida os controles e sobe os quatro processos. Configuração privada fica em `.local/executor-dev`, ignorada pelo Git. Usa o banco/Gemini/login de `backend/.env`, preservando esse arquivo. Não precisa preencher manualmente variáveis do executor nem criar VM.

## Primeira instalação em outro computador

Instale as dependências dos dois aplicativos e configure `backend/.env` conforme o README:

```powershell
npm --prefix backend ci
npm --prefix frontend ci
npm --prefix backend run migrate
npm run dev:local
```

Não é necessário instalar dependências na raiz. O host foi validado com Node 20.20; a imagem de testes usa Node 22. Portas 3000, 5173 e 8091 precisam estar livres. O comando informa uma porta ocupada sem encerrar outros programas.

## Fluxo no painel

1. Cadastre o repositório público e confira seu SHA.
2. Adicione requisitos, gere e revise requisitos/casos textuais.
3. Em Scripts, inspecione esse SHA, selecione fontes Node compatíveis e gere/revise os scripts.
4. Em Execução, confira **Docker Desktop · desenvolvimento local**, justifique e autorize.
5. Consulte resultados/logs; em Análise, revise as propostas do agente 4 e exporte os dados.

O adaptador local provisionado é **Node com `node:test`**, sem instalação de pacotes. Java/JUnit exige uma imagem adicional provisionada e validada. A suíte antiga não é executada automaticamente. Um projeto pode depender de pacotes/GUI/banco ainda não suportados: isso continua sendo uma limitação técnica, mesmo com Docker ligado.

## Perfis e rastreabilidade

`docker-desktop-dev` é uma escolha explícita para desenvolvimento. Usa o serviço autenticado em `127.0.0.1:8091`, com HTTP permitido apenas em loopback e fora de `NODE_ENV=production`. O serviço confirma Docker Desktop/Linux/cgroups/seccomp e executa os mesmos probes de recursos, rede e permissões. Testes continuam em contêineres sem rede, com root read-only, usuário sem privilégios, limites e limpeza; não executa fontes no processo da API/worker.

Recibo, evidências e exportações registram `isolation_profile=docker-desktop-dev`, `development_only=true` e o runtime. O ambiente é compartilhado com os outros projetos do Docker Desktop e não é apresentado como VM dedicada ou rootless. Compare experimentos com condições registradas; revisões técnicas automatizadas e documentos sintéticos precisam continuar identificados.

`dedicated-vm` continua sendo o padrão dos serviços iniciados manualmente, com TLS/VM/rootless/systemd. Instruções em [executor/README.md](../executor/README.md). O comando local não altera esse padrão nem os arquivos `.env` existentes.

## Problemas comuns

- **Docker indisponível:** abra Docker Desktop e aguarde o engine ficar pronto.
- **Porta ocupada:** encerre a execução anterior no terminal com Ctrl+C e execute novamente. Não rode API/worker antigos em paralelo com este comando.
- **Banco/migração:** confira `backend/.env`, disponibilidade PostgreSQL e execute `npm --prefix backend run migrate`.
- **Validação expirada:** o recibo dura uma hora. Reinicie o comando para executar os probes novamente.
- **Gemini indisponível:** o executor não usa Gemini; a geração/avaliação ainda exige chave/modelo válidos no backend.
- **Requisitos falharam com partes concluídas:** use **Continuar a partir dos checkpoints**, com justificativa. A nova análise preserva documentos/SHA e reaproveita as partes válidas; links permitem consultar o histórico anterior. Não precisa reenviar o PDF. Atualize API/worker e aplique a migração 015 antes de usar essa função.
- **Citação reescrita ou resposta incompleta:** versões atuais do agente 1 usam IDs de trechos literais e entradas menores; `MAX_TOKENS` aparece explicitamente no histórico. Respostas inválidas anteriores permanecem preservadas. Revise os requisitos resultantes antes de autorizar os casos de teste.

Para preparar apenas a imagem/configuração, use `npm run executor:setup`. Para iniciar somente o serviço, use `npm run executor:local`. O fluxo usual usa somente `npm run dev:local`.
