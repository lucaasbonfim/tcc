# Serviço executor isolado

Implementação independente da API: Node HTTP(S), sem `pg`, Gemini, `.env` do backend ou ferramentas de LLM. Recebe somente bundle autorizado, verifica hashes/vínculo Git e aciona comandos Docker fixos. Código dos projetos roda exclusivamente em contêineres, nunca na API/worker.

Para desenvolvimento no PC com Docker Desktop, execute **`npm run dev:local` na raiz do projeto**. O comando configura/inicia os quatro processos automaticamente, preservando `.env`. [Guia local](../docs/DESENVOLVIMENTO_LOCAL.md). O perfil `docker-desktop-dev` é explícito, limitado a loopback e recusado em produção; os resultados registram esse ambiente. O restante da seção de implantação abaixo descreve o perfil padrão `dedicated-vm`.

## Estado da validação

Os testes padrão injetam Docker e não executam código externo. A imagem Node passou em 14 controles e dez cenários sintéticos reais, incluindo falha, erro, dependência, permissões, timeout e cancelamento. O perfil local usa esse runtime com recibo verdadeiro e registra `development_only=true`; não declara VM dedicada/rootless. **Java e a implantação dedicada continuam pendentes.** Ambos os perfis continuam fechados se os probes/limites/imagens falharem.

## Implantação dedicada

1. Provisionar VM Linux descartável/dedicada, sem segredos ou credenciais do banco principal, com rede administrativa restrita e TLS. Use Node LTS suportado (22.13+).
2. Instalar Docker rootless com seccomp e cgroups v2/systemd; delegar CPU, memória e pids. Os limites rootless podem ser ignorados sem delegação adequada, por isso o probe lê os controladores reais dentro do contêiner ([documentação Docker](https://docs.docker.com/engine/security/rootless/tips/)).
3. Preparar imagens por meio dos Dockerfiles em `images`, com contexto na raiz deste repositório. `.dockerignore` permite somente runners, protocolo, Dockerfiles e jar JUnit provisionado; não envia `.env`, banco, artefatos ou dependências ao build. `NODE_BASE`/`JAVA_BASE` devem ser referências oficiais fixadas por digest, conferidas pelo operador. Nada faz pull automático durante um trabalho.
4. Para Java, fornecer `executor/vendor/junit-platform-console-standalone.jar` obtido de fonte oficial e verificado por checksum. Passe esse hash em `JUNIT_SHA256` no build e `junit_sha256` na política. O probe verifica `javac`, versão do Console JUnit e hash do jar na imagem. O jar não é versionado. A imagem reúne Node (runner confiável), JDK e JUnit; o primeiro adaptador compila apenas classes selecionadas/JDK, sem plugins/downloads Maven.
5. Precarregar imagens na VM e usar seus IDs `sha256:...` em `policy.local.json`, a partir de `policy.example.json`. Identificar a VM/deployment, e declarar JUnit provisionado apenas após validar compilação e execução do piloto.
6. Configurar um token aleatório de pelo menos 32 caracteres por variável `EXECUTOR_TOKEN` ou secret manager da VM. Não colocá-lo na política, argumentos, repositório ou contêiner. Configurar `EXECUTOR_POLICY_FILE`, diretório privado `EXECUTOR_JOURNAL_DIR`, certificados `EXECUTOR_TLS_CERT`/`EXECUTOR_TLS_KEY` e bind administrativo.
7. Iniciar `npm start` dentro de `executor`. O padrão sem TLS vincula somente loopback, para proxy TLS na mesma VM. A API principal deve acessar por **HTTPS com certificado válido**. Nunca publicar a porta sem autenticação/firewall.

Exemplo de build (substitua os digests por valores reais verificados; não há tags mutáveis padrão):

```bash
docker build --network=none --build-arg NODE_BASE=node@sha256:DIGEST_VERIFICADO -f executor/images/Dockerfile.node -t research-node:v1 .
docker image inspect research-node:v1 --format '{{.Id}}'
```

O boot verifica VM via `systemd-detect-virt --vm`, Docker rootless/seccomp/cgroups e executa **somente o probe confiável** de cada imagem provisionada. O probe comprova UID, capacidades, no-new-privileges, root read-only, CPU/memória/pids efetivos, rede loopback, tmpfs e ausência de socket/segredos. O recibo expira em uma hora; reinicie/revalide para renovar. O runner repete o probe a cada trabalho. Esses controles não substituem a auditoria operacional da VM e de suas políticas de rede/armazenamento.

## Controles de cada trabalho

- Comandos construídos por adaptador, vetores sem shell. O bundle não define comando, imagem ou limites.
- Um contêiner por UUID, sem privilégios/mounts do host/socket, usuário 1000, capacidades removidas, root read-only, rede `none`, CPU 1, memória/swap 256 MiB, 64 processos e prazo externo de 60 s.
- `/work` tmpfs 64 MiB, `/tmp` 16 MiB, `/project` 2 MiB. Inicializador fixo `install.mjs`, sem executar fontes, recebe JSON limitado, confere o contrato e grava arquivos root/0444 e diretórios 0555. Somente essa preparação usa UID 0, com capacidades removidas e raiz read-only; testes/runner continuam UID 1000. Não usa `docker cp` (recusado pelo daemon com root read-only), tar, shell ou mounts do host. O runner recebe o mesmo bundle por linha JSON, confere hashes/permissões e só então carrega testes. O tmpfs é descartado na remoção.
- Fontes originais pertencem ao SHA segundo árvore GitHub consultada pelo executor. Não há clone/build/install no host, alteração do repositório do usuário ou acesso a arquivos arbitrários.
- Node usa `node:test`, entrada/reporter confiáveis e somente o arquivo gerado selecionado em `RESEARCH_TEST_FILE`, preservado também em `commands.test_file`. A entrada transforma erros de importação em eventos estruturados; stderr não é usado para deduzir dependência. Sem teste registrado, o resultado é inconclusivo. Stdout dos testes é log, não resultado; a suíte antiga não é descoberta.
- Java usa `javac -proc:none` e JUnit Console headless para classes geradas explícitas; não abre Swing nem inicia banco. O resultado inicial é por classe gerada/caso; não há cobertura por método ou automação de GUI.
- Limite de entrada 1 MiB, saída 2 MiB, até oito trabalhos pendentes e 128 registros. Journals têm teto derivado de quantidade/tamanho (aproximadamente 384 MiB); arquivar comprovados antes de renovar a quota. Sem exclusão automática de evidências.
- `finally` remove o contêiner inclusive após timeout/cancelamento. Falha de limpeza bloqueia novas execuções. Na recuperação, trabalhos interrompidos são limpos e registrados como infraestrutura, sem repetição automática.

## Protocolo

Headers: `Authorization: Bearer TOKEN`. Rotas: `GET /v1/health`, `POST /v1/jobs` com `{bundle,request_sha256}`, `GET /v1/jobs/:id` e `DELETE /v1/jobs/:id`. UUID/hash iguais são idempotentes; mesmo UUID com outro bundle retorna 409. Resultados vinculam SHA, adapter, perfil/runtime, ambiente imutável, comandos, testes, logs, relatórios, duração e exit code. A classificação não afirma defeito funcional por conta própria. O cliente exige correspondência entre perfil autorizado, recibo e evidência. HTTPS é obrigatório no perfil dedicado; HTTP é permitido somente em loopback literal no modo local explícito, fora de produção.

## Testes

`npm test` usa apenas fontes sintéticas e execução Docker injetada, sem iniciar contêineres nem rodar scripts de projetos. Valida restrições, hashes, autenticação, idempotência, indisponibilidade e limpeza. Esses testes **não comprovam isolamento nem constituem evidência da pesquisa**. O piloto real só deve ocorrer depois dos probes e da revisão operacional na VM.

### Diagnóstico técnico com Docker real

Após construir a imagem Node com o comando acima, a partir da raiz do projeto em PowerShell:

```powershell
$env:DOCKER_HOST = docker context inspect --format '{{.Endpoints.docker.Host}}'
$env:EXECUTOR_SMOKE_IMAGE = docker image inspect research-node:v1 --format '{{.Id}}'
$env:EXECUTOR_SMOKE_REPORT = Join-Path (Get-Location).Path '.local/executor-runtime-check/runtime-smoke.json'
cd executor
npm run smoke:runtime
```

Esse comando usa exclusivamente a fixture de soma da plataforma e controles conhecidos, sem GitHub, Gemini, banco ou servidor executor. Exercita 14 controles e dez cenários: passagem, asserção incorreta, erro no teste, dependência ausente, fontes protegidas, log que não vira resultado, skip, nenhum teste, timeout e cancelamento. Os dois últimos interrompem o cliente após 1,5 s para testar limpeza, sem esperar o prazo de produção de 60 s. Cada contêiner precisa ser removido. O relatório marca `production_executor_validated=false`; não altera política, configuração ou `ready` do serviço e não habilita execução de código externo no Docker Desktop.
