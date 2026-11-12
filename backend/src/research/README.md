# Núcleo dos agentes da pesquisa

Comece pelo [orquestrador](orchestrator/index.js) e pelo
[catálogo dos quatro agentes](agents/registry.js).
O [guia completo](../../../docs/GUIA_DOS_AGENTES.md) explica entradas, saídas,
ferramentas, scripts gerados e um roteiro de apresentação.

```text
research/
  worker.js                  processo que chama o orquestrador
  orchestrator/              coordenação geral, fila, etapas e recuperação
  agents/
    requirements/            A1: requisitos
    tests/                   A2: casos e scripts
    execution/               A3: planejamento e diagnóstico
    evaluation/              A4: avaliação
  runtime/                   ciclo comum de modelo, ferramentas e sessões
  services/                  operações da aplicação e persistência dos recursos
  sources/                   documentos, repositório e inspeção estática
  storage/                   artefatos privados, eventos e snapshots
  http/                      rotas Express
  shared/                    erros e validação estrutural
```

O worker é o processo. O orquestrador determinístico coordena o fluxo. Agentes
especializam o trabalho por instruções, contexto, ferramentas e contratos.
O runtime conduz os turnos com o modelo. O [executor](../../../executor/README.md)
é um serviço separado que executa os testes autorizados.

## Onde abrir cada agente

| Papel / perfil | Instruções e declarações | Funções das ferramentas | Contrato de saída |
| --- | --- | --- | --- |
| A1 — requisitos | [definição](agents/requirements/definition.js) | [ferramentas](agents/requirements/tools.js) | [contratos](agents/requirements/contracts.js) |
| A2 — casos | [definição](agents/tests/cases/definition.js) | [ferramentas](agents/tests/cases/tools.js) | [contratos](agents/tests/cases/contracts.js) |
| A2 — scripts | [definição](agents/tests/scripts/definition.js) | [ferramentas](agents/tests/scripts/tools.js) | [contratos](agents/tests/scripts/contracts.js) |
| A3 — planejamento | [definição](agents/execution/planning/definition.js) | [ferramentas](agents/execution/planning/tools.js) | [contratos](agents/execution/planning/contracts.js) |
| A3 — diagnóstico | [definição](agents/execution/diagnosis/definition.js) | [ferramentas](agents/execution/diagnosis/tools.js) | [contratos](agents/execution/diagnosis/contracts.js) |
| A4 — avaliação | [definição](agents/evaluation/definition.js) | [ferramentas](agents/evaluation/tools.js) | [contratos](agents/evaluation/contracts.js) |

`instruction` contém o prompt de sistema. `tools` declara nomes, argumentos e
descrições. Os handlers em `tools.js` realizam as ações e conferem o escopo.
Os perfis fixos ficam junto das definições do papel correspondente.

## Subagentes e fases internas

- [Esclarecimento de requisitos](agents/requirements/subagents/clarification.js):
  A2 consulta um perfil restrito de A1, que atende em uma sessão filha.
- [Revisão de scripts](agents/tests/subagents/script-review.js): A3 consulta um
  perfil restrito de A2; a proposta fica registrada sem aplicação automática.

Casos/scripts de A2 e planejamento/diagnóstico de A3 são fases do mesmo papel.
Quatro agentes podem produzir cinco etapas persistidas e várias sessões.

## Como acompanhar uma execução

1. [Criação da análise](services/runs.js) preserva código, documentos e perfis.
2. [Worker](worker.js) chama `createResearchOrchestrator` pela entrada pública.
3. [Orquestrador](orchestrator/research-orchestrator.js) seleciona e conduz a etapa.
4. [Handlers](orchestrator/stage-handlers.js) preparam entradas e ferramentas.
5. [Runtime](runtime/run-agent.js) alterna modelo e ferramentas até a submissão.
6. [Serviço de execução](services/execution.js) encaminha bundles autorizados.
7. [Armazenamento](storage/artifacts.js) e serviços preservam saídas e evidências.

Testes gerados pelo A2 são artefatos privados, normalmente sob
`backend/artifacts`, referenciados por `research.automated_tests`. O conteúdo é
apresentado na aba Scripts. Esses arquivos não pertencem à implementação dos agentes.

Os modos `fixed/v1` e `agent/v1` são registrados por etapa. Os modos assistido e
autônomo controlam a intervenção humana. Para explicar uma análise concreta,
consulte seu snapshot e suas sessões, além do mapa da interface.
