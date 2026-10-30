# Serviço executor isolado

Implementação independente da API: Node HTTP(S), sem `pg`, Gemini, `.env` do backend ou ferramentas de LLM. Recebe somente bundle autorizado de fontes e testes gerados, verifica hashes/vínculo Git no SHA e aciona comandos Docker fixos. **Não executar este serviço no ambiente principal da aplicação.**

## Estado da validação

Os testes do serviço injetam o transporte Docker e não executam código externo. O ambiente de desenvolvimento não possui daemon Docker/VM dedicada disponível. Portanto imagens, probes e execução do piloto **ainda precisam de validação na VM**. A implementação permanece fechada se qualquer pré-condição falhar. Não basta configurar uma variável para declarar o executor disponível.

## Implantação dedicada

1. Provisionar VM Linux descartável/dedicada, sem segredos ou credenciais do banco principal, com rede administrativa restrita e TLS. Use Node LTS suportado (22.13+).
2. Instalar Docker rootless com seccomp e cgroups v2/systemd; delegar CPU, memória e pids. Os limites rootless podem ser ignorados sem delegação adequada, por isso o probe lê os controladores reais dentro do contêiner ([documentação Docker](https://docs.docker.com/engine/security/rootless/tips/)).
3. Preparar imagens por meio dos Dockerfiles em `images`, com contexto na raiz deste repositório. `NODE_BASE`/`JAVA_BASE` devem ser referências oficiais fixadas por digest, conferidas pelo operador. Nada faz pull automático durante um trabalho.
4. Para Java, fornecer `executor/vendor/junit-platform-console-standalone.jar` obtido de fonte oficial e verificado por checksum. O jar não é versionado. A imagem reúne Node (runner confiável), JDK e JUnit; o primeiro adaptador compila apenas classes selecionadas/JDK, sem plugins/downloads Maven.
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
- `/work` tmpfs 64 MiB, `/tmp` 16 MiB, `/project` 2 MiB. Fontes/testes são copiados pelo serviço para `/project`, com dono root/permissões 0444 e diretórios sem escrita pelo usuário dos testes. O runner confere hashes e permissões antes de começar. O tmpfs é descartado na remoção do contêiner.
- Fontes originais pertencem ao SHA segundo árvore GitHub consultada pelo executor. Não há clone/build/install no host, alteração do repositório do usuário ou acesso a arquivos arbitrários.
- Node executa somente arquivos gerados explícitos usando `node:test` e reporter confiável; stdout de testes é evento de log, não resultado de teste. A suíte existente não é descoberta automaticamente.
- Java usa `javac -proc:none` e JUnit Console headless para classes geradas explícitas; não abre Swing nem inicia banco. O resultado inicial é por classe gerada/caso; não há cobertura por método ou automação de GUI.
- Limite de entrada 1 MiB, saída 2 MiB, até oito trabalhos pendentes e 128 registros. Journals têm teto derivado de quantidade/tamanho (aproximadamente 384 MiB); arquivar comprovados antes de renovar a quota. Sem exclusão automática de evidências.
- `finally` remove o contêiner inclusive após timeout/cancelamento. Falha de limpeza bloqueia novas execuções. Na recuperação, trabalhos interrompidos são limpos e registrados como infraestrutura, sem repetição automática.

## Protocolo

Headers: `Authorization: Bearer TOKEN`. Rotas: `GET /v1/health`, `POST /v1/jobs` com `{bundle,request_sha256}`, `GET /v1/jobs/:id` e `DELETE /v1/jobs/:id`. UUID/hash iguais são idempotentes; mesmo UUID com outro bundle retorna 409. Resultados vinculam SHA, adapter, ambiente imutável, comandos, testes, logs, relatórios, duração e exit code. A classificação não afirma defeito funcional por conta própria.

## Testes

`npm test` usa apenas fontes sintéticas e execução Docker injetada, sem iniciar contêineres nem rodar scripts de projetos. Valida restrições, hashes, autenticação, idempotência, indisponibilidade e limpeza. Esses testes **não comprovam isolamento nem constituem evidência da pesquisa**. O piloto real só deve ocorrer depois dos probes e da revisão operacional na VM.
