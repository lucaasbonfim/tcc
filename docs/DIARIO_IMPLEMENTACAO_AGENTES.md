# Diário técnico da implementação dos agentes

Iniciado em 04/11/2026. Plano associado: [PLANO_IMPLEMENTACAO_AGENTES.md](PLANO_IMPLEMENTACAO_AGENTES.md).

Este registro documenta decisões e mudanças efetivamente realizadas para apoiar a escrita posterior da metodologia e da descrição da arquitetura no TCC. Cada tarefa recebe uma entrada e um commit próprio. As entradas anteriores são preservadas; correções de interpretação são registradas como complemento datado.

## Estado atual

| Marco | Estado | Evidência |
| --- | --- | --- |
| M0 — planejamento | Concluído | Documentos e commit identificados por AG-00 |
| M1 — A2 com ferramentas | Em implementação | AG-01–AG-05 concluídas; próxima tarefa: AG-06 |
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

## 04/11/2026 — AG-02: persistência da trajetória e orçamento

**Estado:** concluído. Base: `15876c5`.

**Mudança implementada:** migração aditiva 019 com sessões, turnos e chamadas; FKs para análise/etapa/tentativa/parte, identificadores únicos e somente uma sessão ativa por parte. `agent-sessions.js` registra requisição antes da chamada, resposta/uso do provedor e observações imutáveis por hash; reserva contadores em transações curtas com locks na ordem análise → etapa → sessão.

**Decisões:** a posse da tarefa é conferida por lease/token em toda escrita; outro worker não pode concluir a sessão. Repetir a mesma resposta/chamada não soma novamente tokens nem efeitos. Uma nova tentativa da mesma parte herda o consumo acumulado para os limites de chamadas/tokens/ferramentas, além do teto global da análise. Resposta ausente é marcada como consumo desconhecido quando o turno é interrompido. Estados detalhados não alteram os estados históricos da plataforma.

**Verificação:** `node scripts/test-agents-local.mjs test/integration/agent-sessions.test.js test/integration/database.test.js`, no backend: dois testes de integração aprovados, zero falhas/ignorados. Cobrem migração reexecutável, concorrência ao reservar turno, orçamento herdado, contabilização idempotente, recusa de token alheio e vínculos inválidos. Primeiras verificações foram feitas em banco remoto separado de desenvolvimento; a conferência final usou PostgreSQL 17 local isolado em `127.0.0.1:55439`, banco `tcc_test_agents_dev`, com fixtures.

**Ambiente:** para evitar a latência do servidor remoto nas próximas tarefas, foi iniciado um cluster local de teste sob `.local/agent-test-pg`, escutando somente em loopback. A configuração do destino fica em `.local/agent-tests.env`, ignorado. O helper versionado exige destino `tcc_test_*` explícito e não cria/migra o banco real. A migração 019 não foi aplicada ao banco da pesquisa nesta tarefa.

**Limitações:** ainda não há integração do runtime ao worker; retomada de conversa e tratamento de retorno tardio serão exercitados com o ciclo em AG-05/AG-06. Não há chamada de IA ou resultado experimental nesta validação.

**Rastreabilidade:** commit `[AG-02]`. **Próximo passo:** AG-03, turnos Gemini com ferramentas.

## 04/11/2026 — AG-03: turnos Gemini com chamadas de ferramentas

**Estado:** concluído. Base: `c044e64`.

**Mudança implementada:** `createAgentTurnGateway` em `model.js` aceita conversa nativa e catálogo de ferramentas, usa `parametersJsonSchema` e solicita chamadas por function calling. Não configura simultaneamente schema/MIME de resposta JSON. A operação JSON anterior permanece disponível. Partes nativas e assinaturas técnicas são preservadas; chamadas sem ID recebem um identificador preservado no conteúdo e no histórico. Campos de transporte/cabeçalhos do SDK não entram na saída bruta selecionada.

**Verificação:** `node --test test/model.test.js test/agents.test.js test/agent-contract.test.js`: 11 testes aprovados, zero falhas/ignorados. Cobrem múltiplas chamadas, IDs, assinatura opaca, recusa, término por limite, cancelamento e timeout mesmo quando o provedor injetado ignora abort. Regressão dos contratos/gateway anteriores aprovada. Nenhuma chamada real ao Gemini.

**Limite:** o gateway executa um turno e não executa ferramentas nem decide permissões. O ciclo e a persistência das observações pertencem às entregas seguintes.

**Rastreabilidade:** commit `[AG-03]`. **Próximo passo:** AG-04, ferramentas de consulta e escopo efetivo.

## 04/11/2026 — AG-04: ferramentas e escopo efetivo do A2

**Estado:** concluído. Base: `691f318`.

**Mudança implementada:** registro de ferramentas e conjunto de consulta/submissão para A2. O manifesto e as leituras vêm da inspeção preservada no SHA da tarefa; módulos aninhados não podem ser consultados como se pertencessem ao módulo pai. Observações longas têm limite serializado e truncamento explícito. Preparar o escopo calcula dependências locais e preserva um artefato com hash; submissões exigem esse escopo e passam pelo contrato anterior, inclusive esperado, interfaces e vínculos.

**Verificação:** `node --test test/automation-agent-tools.test.js test/automation.test.js test/inspection.test.js`: nove testes aprovados, zero falhas/ignorados. Verificam fonte autorizada, recusa de travessia/URL/módulo alheio, dependência externa não provisionada, fechamento local, restauração de escopo e recusa de alteração do esperado. Evidência: fixtures estáticas de repositório e armazenamento temporário; nenhum código alvo foi executado.

**Decisão:** as fontes lidas para entender o projeto não se tornam automaticamente fontes do bundle; a submissão devolve um `input.scope` efetivo para o consumidor atual. A confirmação terminal indica necessidade de revisão, não aprovação ou execução. Capacidades informadas são estáticas/versionadas, sem alegar disponibilidade atual do serviço executor.

**Limitação:** a restauração de escopo está disponível ao runtime, mas o ciclo persistido ainda será integrado na tarefa seguinte.

**Rastreabilidade:** commit `[AG-04]`. **Próximo passo:** AG-05.

## 04/11/2026 — AG-05: ciclo persistido, interrupção e retomada

**Estado:** concluído. Base: `f84b658`.

**Mudança implementada:** `agent-runtime.js` realiza turnos, executa ferramentas permitidas e devolve observações à conversa nativa. Cada resposta e chamada são registradas com checkpoints imutáveis. O ciclo tem heartbeat, prazo cumulativo, limites de chamadas/tokens, detecção de repetição sem progresso e submissão terminal separada. O fingerprint da tarefa permite herdar contexto somente da mesma entrada; o consumo anterior permanece contabilizado.

**Retomada:** uma nova tentativa pode adotar um turno já recebido, reutilizar observações confirmadas e executar só a ferramenta pendente. Escopos preparados ficam também no estado privado do checkpoint, sobrevivendo a falha na chamada posterior ao modelo. Chamadas de respostas parciais ou sem IDs únicos não são executadas. Retorno tardio preserva resposta e metadados sem concluir a etapa pertencente a outro worker.

**Verificação:** suíte completa via `node scripts/test-agents-local.mjs`: 72 testes aprovados, zero falhas/ignorados, usando banco PostgreSQL de teste local. A verificação focal de runtime/sessões/ferramentas teve nove testes aprovados. Controles incluem interrupção entre duas ferramentas, interrupção após preparar escopo, orçamento esgotado, `MAX_TOKENS`, troca do token de posse e regressões do fluxo anterior. Provedor/executor injetados, sem Gemini real.

**Limite:** os testes demonstram o funcionamento do mecanismo e da retomada com respostas programadas; não medem a capacidade de um LLM real de tomar boas decisões. A ligação ao processador, modos de criação e revisão será entregue em AG-06.

**Rastreabilidade:** commit `[AG-05]`. **Próximo passo:** AG-06.

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
