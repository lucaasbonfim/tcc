# Diário técnico da implementação dos agentes

Iniciado em 04/11/2026. Plano associado: [PLANO_IMPLEMENTACAO_AGENTES.md](PLANO_IMPLEMENTACAO_AGENTES.md).

Este registro documenta decisões e mudanças efetivamente realizadas para apoiar a escrita posterior da metodologia e da descrição da arquitetura no TCC. Cada tarefa recebe uma entrada e um commit próprio. As entradas anteriores são preservadas; correções de interpretação são registradas como complemento datado.

## Estado atual

| Marco | Estado | Evidência |
| --- | --- | --- |
| M0 — planejamento | Concluído | Documentos e commit identificados por AG-00 |
| M1 — A2 com ferramentas | Em implementação | AG-01 concluída; próxima tarefa: AG-02 |
| M2 — outros papéis e colaboração | Planejado | Depende da avaliação de M1 |
| M3 — planejamento/diagnóstico da execução | Planejado | Depende das entregas anteriores e da necessidade do recorte |
| M4 — protocolo de coleta | Planejado | Critérios ainda não congelados |

“Concluído” para uma tarefa de documentação não significa código agentivo entregue ou resultado experimental obtido.

## Convenções para o registro

- **Planejado:** decisão de trabalho ainda não implementada.
- **Implementado:** mudança presente em código e identificada no Git.
- **Verificado tecnicamente:** comportamento observado com ambiente, comando e resultado registrados.
- **Avaliado no estudo:** resultado coletado sob protocolo e referência de julgamento identificados.

Classificar a evidência de cada verificação como inspeção de código/documento, teste com fixture, controle sintético, execução em repositório real ou julgamento humano. Aprovação de revisão na interface, por si só, não demonstra julgamento humano independente.

O ID de tarefa também consta no assunto do commit. Para encontrar o hash de uma entrega, usar `git log --oneline --grep=AG-00`, substituindo o ID conforme necessário. Isso evita inserir no próprio arquivo o hash autorreferente do commit que o cria.

## 04/11/2026 — AG-00: planejamento e organização do registro

**Estado:** concluído como tarefa de documentação. Base de código inspecionada: `f1a6722`.

**Motivação:** a arquitetura existente usa etapas com prompts especializados e controle pelo servidor. O pesquisador solicitou agentes com escolhas de ações e ferramentas, um planejamento antes de codificar, commits por tarefa e documentação para a escrita do TCC.

**Inspeção realizada:** gateway Gemini, worker/processador, automação e seus lotes, armazenamento de artefatos, migrações e modelo de execução, exportação, pontos de integração da interface e procedimentos de teste. O SDK instalado já expõe tipos de chamadas e respostas de função. O gateway em uso ainda não fornece essas ferramentas ao modelo.

**Decisões registradas:**

1. Começar pela subetapa `automation` do A2, usando casos e requisitos já aprovados.
2. Acrescentar um ciclo com ferramentas, observações, limites e parada; manter identificável o modo atual para compatibilidade e eventual comparação.
3. Persistir trajetórias e escopo efetivo antes de ampliar os papéis. A escolha de fontes precisa chegar ao bundle executado, não ficar somente no histórico de leitura.
4. Tratar autorização de execução, aprovação humana e saída automática como operações distintas. A primeira entrega de A2 terá ferramentas de consulta e submissão, sem execução preliminar de scripts não aprovados.
5. Expandir A1/A2 textual/A4 e colaboração depois de validar M1; desenvolver A3 acima do executor determinístico somente com decisões de planejamento/diagnóstico úteis.
6. Manter limites e versões explícitos e avaliar os testes contra referência definida fora da conclusão da própria IA.

**Entrega efetiva:** plano com marcos M0–M4 e tarefas AG-00–AG-16; este diário; links no README e indicação da evolução planejada na arquitetura atual. Nenhuma funcionalidade de agente com ferramentas foi implementada nesta tarefa.

**Verificação da entrega:** revisão dos links locais e dos caminhos existentes mencionados como pontos de integração; verificação do diff e de whitespace; conferência do stage para incluir somente documentação da tarefa. Arquivos nomeados como novos/propostos no plano não são apresentados como existentes.

**Resultado da conferência documental:** quatro documentos examinados, 26 links locais resolvidos, 11 caminhos existentes de integração conferidos e 17 tarefas identificadas, com apenas AG-00 marcada como concluída. Nenhuma falha encontrada nesses controles; `git diff --check` sem erros de whitespace.

**Escopo da validação:** documental. Não foi rodada uma nova suíte da aplicação, aplicado SQL ao banco, iniciado o sistema ou feita chamada paga ao Gemini nesta tarefa. Resultados técnicos de 30/10/2026 permanecem históricos, não são resultados de validação da nova arquitetura.

**Limitações abertas:** recorte funcional do piloto ainda não escolhido; limites de passos/tempo ainda são hipóteses de engenharia; ambiente Java continua com as restrições atuais; reaplicação de suítes a versões e execução em múltiplos bundles exigem evolução própria. Este plano não demonstra superioridade de agentes.

**Rastreabilidade Git:** commit da tarefa identificado por `[AG-00]`. Antes da tarefa, a aplicação estava em `main`, dez commits à frente de `origin/main`, e havia o arquivo local não rastreado `atual.java`; esse arquivo não integra a entrega.

**Uso posterior no TCC:** base para explicar a motivação da evolução, os limites da arquitetura inicial e as decisões prospectivas de implementação. Não descrever as tarefas pendentes como funcionalidades entregues ou os critérios propostos como resultados observados.

**Próximo passo:** AG-01 — contratos e política do ciclo.

## 04/11/2026 — AG-01: contratos e política do ciclo

**Estado:** concluído. Base: `9338f84`.

**Mudança implementada:** `agent-policy.js` define modos por subetapa, limites de sessão/análise e política versionada/imutável. `agent-contract.js` define as oito ferramentas iniciais do A2, submissão terminal, instrução agentiva independente do prompt anterior, estados e transições de sessão. A configuração ausente em snapshot antigo é interpretada como modo fixo, sem reescrever o artefato.

**Decisões:** apenas automação pode selecionar `agent/v1` neste marco. A submissão precisa responder a todos os casos da tarefa exatamente uma vez. Campos inesperados, acesso a requisito/caso externo, ferramenta desconhecida e limites inválidos são recusados. Esgotamento mapeia para falha incompleta, não para aprovação ou impossibilidade do requisito. O catálogo é imutável e usa uma cópia do schema anterior para não alterar seu objeto compartilhado.

**Verificação:** `node --test test/agent-contract.test.js test/agents.test.js test/automation.test.js`, no backend: 12 testes aprovados, zero falhas/ignorados. Evidência: testes locais com dados/provedor injetados, incluindo regressão dos contratos e do gateway existentes; sem Gemini real ou banco da pesquisa.

**Limite da entrega:** ainda não há ciclo executando ferramentas nem persistência de sessão; esses contratos constituem a interface para AG-02–AG-06. Não equivalem a um agente operacional.

**Rastreabilidade:** commit com ID `[AG-01]`. **Próximo passo:** AG-02, persistência de sessões/passos/chamadas.

## Modelo para a próxima entrada

Copiar o bloco abaixo para uma entrada datada, preenchendo-o antes de concluir a tarefa e criar o commit:

```text
Data e tarefa:
Estado: planejado / em andamento / concluído / impedido, com motivo
Base de código:
Problema observado e motivação:
Decisão e alternativa considerada:
Mudança efetivamente implementada:
Arquivos e contratos afetados:
Decisões/ferramentas que o agente passou a exercer:
Verificação: comando, ambiente e natureza da evidência
Resultado observado: contagens, falhas, itens não executados e limitações
Artefatos/evidências: IDs, hashes ou caminhos locais ignorados, sem segredos
Intervenções humanas e mudanças de versão:
Limitações abertas e impacto no protocolo:
Rastreabilidade Git: ID da tarefa no commit; hashes de dependências quando úteis
O que esta entrega permite afirmar no TCC:
Próxima tarefa:
```
