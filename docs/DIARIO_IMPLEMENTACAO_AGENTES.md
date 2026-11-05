# Diário técnico da implementação dos agentes

Iniciado em 04/11/2026. Plano associado: [PLANO_IMPLEMENTACAO_AGENTES.md](PLANO_IMPLEMENTACAO_AGENTES.md).

Este registro documenta decisões e mudanças efetivamente realizadas para apoiar a escrita posterior da metodologia e da descrição da arquitetura no TCC. Cada tarefa recebe uma entrada e um commit próprio. As entradas anteriores são preservadas; correções de interpretação são registradas como complemento datado.

## Estado atual

| Marco | Estado | Evidência |
| --- | --- | --- |
| M0 — planejamento | Concluído | Documentos e commit identificados por AG-00 |
| M1 — A2 com ferramentas | Concluído tecnicamente | AG-01–AG-09, com piloto real e falhas preservadas |
| M2 — outros papéis e colaboração | Em implementação | AG-10 concluída; próxima tarefa: AG-11 |
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

## 04/11/2026 — AG-06: integração de A2 ao processador

**Estado:** concluído. Base: `d7ea9a8`.

**Mudança implementada:** novas análises preservam política/modos no snapshot. Automação usa o modo fixado e instrução correspondente; no modo agentivo, o modelo consulta o módulo e escolhe o escopo, sem rodízio obrigatório de fontes pelo servidor. O processador executa o runtime e registra a entrada final com `input.scope` efetivo, mantendo os contratos, revisão, autorização e executor existentes. Cancelamento/recuperação encerram sessões relacionadas sem reabrir a análise.

**Verificação:** seis testes focais de integração aprovados (`agent-automation`, `automation` e `automation-parts`). O controle agentivo usa três turnos com respostas injetadas, consulta o manifesto e escolhe `src/other.js` em vez da fonte inicial `src/calc.js`; revisão e bundle recebem exclusivamente o escopo escolhido. Outro controle esgota orçamento, repete a etapa e comprova ausência de nova chamada ou fallback fixo. Os controles legados de 104 cenários, checkpoints parciais e cancelamento permanecem aprovados.

**Limitações:** execução/avaliação desse teste usam fixtures, não observações reais do programa. A integração está disponível pela API/configuração do snapshot; escolha na interface e exportação detalhada serão entregues nas tarefas seguintes. Ambientes existentes precisam aplicar a migração 019 antes de reiniciar a nova versão. O banco da pesquisa ainda não foi migrado nesta tarefa; o piloto operacional está previsto em AG-09.

**Rastreabilidade:** commit `[AG-06]`. **Próximo passo:** AG-07.

## 04/11/2026 — AG-07: consulta e exportação da trajetória

**Estado:** concluído. Base: `ba58fdb`.

**Mudança implementada:** serviço de histórico paginado, endpoints administrativos de sessões/turnos/chamadas e artefatos vinculados, resumo operacional e exportação JSON/CSV versão 3. A exportação inclui requisições, respostas, argumentos, observações, escopos preparados e saídas, também quando há falha ou interrupção. Campos anteriores são mantidos e análises sem sessões retornam coleções vazias.

**Ajuste encontrado durante a implementação:** o prazo cumulativo necessário para retomar a tarefa não pode ser somado como duração de cada tentativa. O checkpoint passou a registrar separadamente tempo acumulado e tempo da tentativa; a duração da sessão passa a contar somente o período ativo dessa tentativa. O resumo distingue tokens reportados de consumo desconhecido e mantém custo não informado.

**Verificação:** 11 testes focais aprovados (acesso, CSV, integração agentiva e runtime), zero falhas/ignorados. Conferidos paginação, associação de artefatos à sessão/análise, acesso administrativo, exportação de três turnos/seis ferramentas e retomada/cancelamento. Ambiente PostgreSQL local de teste e provedores injetados; sem consumo Gemini.

**Limite:** exportar durante o processamento reflete leituras de um estado em evolução. A coleta científica deverá congelar as condições e conferir os artefatos estabilizados, em vez de tratar esse download como snapshot transacional do banco.

**Rastreabilidade:** commit `[AG-07]`. **Próximo passo:** AG-08.

## 04/11/2026 — AG-08: modo e trajetória na interface

**Estado:** concluído. Base: `7a020ab`.

**Mudança implementada:** seleção do modo de geração de scripts antes de criar a análise, indicação do comportamento correspondente na aba Scripts e painel de trajetória no histórico. O painel permite consultar sessões, turnos, argumentos e observações, com paginação e atualização durante o processamento. Mostra limites/interrupções, tokens parciais e submissão para revisão como fatos diferentes da execução.

**Verificação:** lint e build frontend aprovados. Quatro cenários E2E aprovados com PostgreSQL de teste e respostas/executor injetados: percurso completo no modo agentivo com exportação de três turnos/seis ferramentas; limite de orçamento; cancelamento em andamento; regressão do modo fixo com 104 cenários. Conferidos viewport de 390 px, ausência de overflow e de erros JavaScript; captura do histórico móvel inspecionada visualmente.

**Ocorrências da validação:** o Chromium padrão exigido pela instalação atual do Playwright não estava disponível. Usado o executável já instalado `chromium_headless_shell-1243`, pela configuração explícita existente. Na primeira execução funcional, três cenários passaram e o percurso principal parou no localizador do seletor; foi trocado por consulta ao papel acessível `combobox`, e o cenário completo passou em 24,3 s. Não foi alterado o comportamento do produto para acomodar esse localizador.

**Limite:** a interface está integrada a código real, mas esses testes de navegador usam fixtures. A operação com Gemini/executor reais continua sendo a próxima tarefa. Capturas e traces da suíte ficam em diretórios locais ignorados.

**Rastreabilidade:** commit `[AG-08]`. **Próximo passo:** AG-09.

## 04/11/2026 — AG-09a: correções identificadas no primeiro piloto real

**Estado:** subtarefa concluída; AG-09 continua em andamento. Base: `d6c59f0`.

**Preparação operacional:** serviços iniciados com Docker Desktop, imagens e recibo validados. Antes de migrar o banco existente, confirmada ausência de análises ativas; realizados dump do schema/dados `research` e cópia dos 263 artefatos privados. O cliente pg_dump 17 foi recusado pelo servidor 18.6; o backup foi concluído com pg_dump 18 em imagem oficial fixada por digest. Migração 019 aplicada sozinha, com contagens das oito entidades principais preservadas. Manifesto, dump e artefatos permanecem em `.local/agent-pilot/backup-DFx9yv/`, fora do Git.

**Observação real:** análise `7201747c-75d1-4927-9455-c327b3779bc8`, projeto técnico is-number no SHA `98e8ff1da1a89f93d1397a24d7413ed15421c139`. Gemini reportou `gemini-3.5-flash-lite`. A sessão usou oito turnos, oito ferramentas, 25.179 tokens reportados e 91.673 ms; falhou por `scope_violation`, não por orçamento. No último turno, passou os caminhos dos testes a gerar como `target_paths` do escopo. A ferramenta recusou e nenhum script foi persistido. O agente também havia lido `test.js`, classificado pelo leitor anterior como fonte comum.

**Mudanças:** o leitor 2.2.0 reconhece arquivos convencionais legados `test.js`, `spec.cjs` e equivalentes, além das pastas/padrões anteriores, como testes existentes. Esses arquivos são preservados na inspeção, mas não ficam disponíveis como fontes de implementação ao A2. A instrução `agent/1.0.1` e a descrição da ferramenta distinguem explicitamente fontes existentes de caminhos dos novos testes. Bloqueios de escopo permanecem ativos; o erro agora é indicado na mensagem da etapa.

**Revisão de rastreabilidade:** definição e catálogo agentivos passaram a ser fixados no snapshot e copiados para a etapa. O runtime usa esse catálogo, em vez de substituir silenciosamente as declarações de uma análise antiga pelas constantes do checkout. O fingerprint inclui a definição. Protótipos agentivos sem contrato preservado exigem nova análise; snapshots legados de modo fixo continuam válidos.

**Verificação:** 18 testes focais aprovados, zero falhas/ignorados, incluindo classificação/recusa de testes legados, recusa dos caminhos gerados como fontes, catálogo correspondente ao snapshot e regressões de integração/retomada. PostgreSQL local isolado e respostas injetadas. A falha real anterior foi exportada integralmente em `.local/agent-pilot/export-eight-turns.json`; não foi descartada ou convertida em sucesso.

**Outras observações:** os dois casos textuais reais foram classificados preliminarmente como `manual_only`, apesar de descreverem uma função pura. Conteúdo e classificação originais foram preservados; a estimativa textual de viabilidade não equivale a uma medição de execução. Revisões deste piloto são técnicas pelo assistente, identificadas como tal, não julgamento humano independente.

**Próximo passo:** nova análise técnica sob condições identificadas, com a instrução corrigida e limite experimental de 12 turnos para acomodar consultas sequenciais. A primeira análise falhou por uso incorreto do escopo; eventual sucesso da nova não permitirá atribuir causalmente a melhora apenas ao limite ou ao prompt, pois há mais de uma mudança.

**Rastreabilidade:** commit `[AG-09a]`.

## 04/11/2026 — AG-09b: diagnóstico seguro da falha de turno

**Estado:** subtarefa concluída; AG-09 continua em andamento. Base: `ba7c4d2`.

**Observação:** a nova análise `d3aa93b7-f139-4f2c-bfda-75d57acd845c`, com instrução 1.0.1, leitor 2.2.0 e limite de 12 turnos, completou seis ferramentas. O sétimo turno ficou sem resposta preservada e a análise encerrou com mensagem genérica, 16.857 tokens reportados e consumo desconhecido. Não se pode concluir retrospectivamente se houve falha de rede, do provedor ou do gateway a partir dessa mensagem.

**Mudança implementada:** falhas de processamento passam a ter artefato diagnóstico com fase, classe do erro e status HTTP quando disponíveis, sem copiar mensagem, stack, cabeçalhos ou URL do SDK. O processador recebe uma mensagem controlada com status e indicação da sessão. Armazenamento indisponível não impede a tentativa de encerrar a sessão. Falhas por orçamento e escopo mantêm sua classificação separada.

**Verificação:** sete testes de integração do runtime aprovados, incluindo erro injetado HTTP 429 com mensagem contendo segredo de controle; o diagnóstico registra status/fase e não contém o segredo. Retomada, orçamento, resposta parcial e retorno tardio continuam aprovados. PostgreSQL local separado, sem chamadas pagas nessa verificação.

**Próximo passo:** preservar a primeira tentativa dessa segunda análise e usar a repetição explícita na mesma condição, reaproveitando contexto e consumo. Se a falha repetir, o diagnóstico permitirá identificar o impedimento sem expor credenciais.

**Rastreabilidade:** commit `[AG-09b]`.

## 04/11/2026 — AG-09: primeiro marco validado com serviços reais

**Estado:** concluído tecnicamente. Base do piloto retomado: `9b42089`; detalhes em [PILOTO_AGENTES.md](PILOTO_AGENTES.md).

**Resultado observado:** a repetição explícita da análise `d3aa93b7-f139-4f2c-bfda-75d57acd845c` reaproveitou as seis consultas concluídas e produziu dois scripts válidos. A primeira submissão usou `node-test` em vez de `node-test/v2`; após a recusa, o agente consultou capacidades e corrigiu o identificador. Esperados e código final dos testes não foram reescritos pelo assistente. A análise terminou com 11 chamadas ao modelo, dez ferramentas, 37.214 tokens reportados (parciais) e 122.308 ms ativos nas duas tentativas.

**Execução:** job `df7aef28-7d1f-45ff-8c37-5918bd5baf8d`, perfil Docker Desktop local, dois testes realmente aprovados, 367 ms informados pelo executor. A4 propôs compatibilidade para os dois cenários; a conferência técnica foi identificada como revisão pelo assistente, sem alegar julgamento humano independente. Exportação e capturas da aplicação real ficam em `.local/agent-pilot/`; a página apresentou zero erros JavaScript e nenhum overflow horizontal em 390 px.

**Calibração:** padrão de novas sessões passa de oito para 12 turnos, preservando 16 ferramentas/180 segundos e os limites explícitos de snapshots antigos. A interface sugere agente para novas análises; API sem configuração e históricos continuam no fluxo fixo. A estrutura da política permanece versão 1.0.0, com valores efetivos preservados no snapshot.

**Validação final:** 76 testes backend aprovados, nove testes executor aprovados, quatro E2E Chromium aprovados e lint/build frontend aprovados. Backend e navegador usam agora bancos locais separados (`tcc_test_agents_backend` e `tcc_test_agents_browser`). Uma verificação paralela anterior compartilhou o banco por engano e dois controles backend falharam por disputa entre os workers de fixtures; os destinos foram separados e as suítes completas passaram. O helper ganhou `--browser`, exige destino próprio e recusa o mesmo nome de banco para as duas suítes. O banco do piloto real não foi usado por essas fixtures.

**Limites científicos:** biblioteca pública, dois requisitos sintéticos, uma configuração desenvolvida em piloto, falha original e recuperação preservadas, consumo de um turno desconhecido. Não há medição de precisão/recall, cobertura integral ou superioridade causal da autonomia. Mudanças entre as duas análises não constituem comparação controlada. A estimativa preliminar `manual_only` dos casos foi preservada e não é tratada como evidência de inviabilidade.

**Revisão do plano:** próximo marco reutiliza o mecanismo para A1, A2 textual e A4, com perfis e ferramentas próprios, vínculos de sessões adequados a partes e contratos de citação mantidos. Essa decisão foi registrada antes de iniciar AG-10.

**Rastreabilidade:** commit `[AG-09]`. **Próximo passo:** AG-10.

## 04/11/2026 — AG-10: A1 com consultas documentais e citações

**Estado:** concluído. Base: `87185dd`.

**Mudança implementada:** perfil A1 com catálogo, consulta em lotes e submissão de requisitos; papéis e ferramentas permanecem fixados por análise. A1 não recebe o texto inteiro na conversa inicial: escolhe consultas dentro das fontes atribuídas. O servidor exige que todos os trechos atribuídos tenham sido efetivamente devolvidos antes da submissão, sem considerar trecho truncado como lido. Metadados de leitura podem ser consultados novamente pelo agente. Citações continuam por source_id resolvido e validado localmente.

**Persistência:** migração 020 acrescenta vínculo a partes de requisitos e permite sessões do papel `requirements`. O orçamento/retomada passa a identificar a unidade de trabalho pela parte ou etapa, preservando teto global. O runtime aceita catálogo e ferramenta terminal por papel. Continuação preserva a definição original; exportação resolve a linhagem e inclui trajetórias dos checkpoints reaproveitados, inclusive após duas continuações.

**Interface/API:** opção “Análise de requisitos com ferramentas” na preparação da análise; continua optativa nesta entrega. Históricos mostram número/papel correto do agente e os nomes das consultas documentais. API aceita `agent_policy.modes.requirements='agent/v1'`; o fluxo fixo permanece disponível.

**Verificação:** 81 testes backend aprovados, zero falhas/ignorados; lint/build frontend aprovados; cinco E2E aprovados, incluindo criação pela opção A1 na interface, consulta dos documentos, trajetória e requisito disponível para revisão. Integrações cobrem documentos extensos em partes, consolidação, duas continuações, preservação de fonte, leitura parcial, recusa de ferramenta alheia e regressão de A2. Evidência: PostgreSQL local separado e provedores injetados, não avaliação real de qualidade de um LLM.

**Atualização do ambiente:** migração 020 aplicada sozinha ao banco existente após novo dump/cópia dos artefatos. Contagens das entidades anteriores e das três tabelas de trajetória preservadas; backup em `.local/agent-pilot/backup-WyBEbw/`, relatório `upgrade-020.json`.

**Limites:** leitura e citação verificadas não demonstram interpretação correta, recall ou identificação correta de ambiguidades. A1 não escreve artefatos aprovados nem acessa código/executor. O piloto real de M1 permanece limitado a A2; uma futura validação conjunta deve registrar as condições novas.

**Rastreabilidade:** commit `[AG-10]`. **Próximo passo:** AG-11, A2 textual.

## 05/11/2026 — AG-11: A2 textual com consultas aos requisitos

**Estado:** concluído. Base: `69295d7`.

**Mudança:** perfil A2 textual fixado no snapshot, ferramentas de catálogo, leitura paginada e submissão de casos. A conversa inicial contém identificadores/títulos; o agente consulta os requisitos aprovados antes de propor cenários. O servidor registra intervalos completos devolvidos, restaura leituras na retomada e exige consulta integral dos requisitos atribuídos. A submissão exige todos os vínculos do lote, preserva códigos globais e mantém revisão humana. O perfil orienta cenários sustentados, registro de ambiguidades e estimativas preliminares de automação; não consulta implementação nem executa testes.

**Persistência/interface:** migração 021 permite sessões `tests` com vínculo ao lote; política, capacidades e opção “Geração de casos com ferramentas” disponíveis. Continuação usa o perfil original. Histórico apresenta as novas consultas.

**Verificação:** 85 testes backend aprovados, zero falhas/ignorados; seis E2E Chromium aprovados; lint/build frontend aprovados. Integrações verificam seis requisitos em dois lotes, códigos únicos, revisão e retomada sem repetir leitura concluída. Testes locais de paginação verificam observações com escape e retomada parcial. Durante a verificação, a restrição de códigos foi isolada no campo requirement_codes: objetos compartilhados do schema não podem propagar o enum aos textos livres. As primeiras execuções de testes expuseram esse problema; a suíte completa passou após a correção.

**Ambiente:** migração 021 aplicada após dump/cópia dos artefatos em `.local/agent-pilot/backup-xCnzV2/`; relatório `upgrade-021.json`, contagens preservadas. Fixtures backend/navegador em bancos locais separados, sem chamadas reais ao provedor.

**Limite para o TCC:** consultas, retomada e rastreabilidade foram verificadas tecnicamente. Não se demonstrou correção dos esperados, qualidade dos limites/exceções ou cobertura semântica por um LLM real. Isso permanece dependente do piloto conjunto e da referência independente do experimento.

**Rastreabilidade:** commit `[AG-11]`. **Próximo passo:** AG-12, A4 com investigação das evidências.

## 05/11/2026 — AG-12: A4 com investigação de evidências

**Estado:** concluído. Base: `8fb5b7c`.

**Mudança:** A4 pode listar resultados e consultar, em páginas, o contexto de um resultado ou seções específicas: observação, requisitos, trechos documentais originais, caso, script aprovado e ambiente. O servidor exige consulta integral dos contextos atribuídos (ou de todas as suas seções). Leituras parciais têm intervalos restauráveis. A submissão continua validada pelo contrato de avaliação existente: todos os pares resultado/requisito, esperado e observado exatos, citação literal e classificação compatível com o estado. Observação truncada permanece inconclusiva mesmo depois de ler todo o contexto disponível.

**Controle:** perfil, ferramentas e contrato fixados no snapshot; modo optativo `evaluation: agent/v1`, opção “Avaliação de evidências com ferramentas”. Migração 022 permite sessões A4. A fila continua exigindo evidência de origem executor. O agente não altera evidência, esperado ou script; a decisão humana fica separada da proposta original. Novas análises também preservam a definição fixa de avaliação, evitando substituí-la pela definição corrente ao enfileirar.

**Verificação:** 90 testes backend aprovados, zero falhas/ignorados; seis E2E aprovados; lint/build aprovados. Testes incluem estados de execução, recusa de textos inventados, referências externas, pares omitidos, leitura por seções, paginação e retomada após falha sem repetir a consulta concluída. O fluxo completo do navegador seleciona o modo A4, recebe conclusão, revisa e exporta a trajetória. Provedor e executor são fixtures, em bancos locais separados.

**Limites:** o validador restringe referências, literalidade e classes admissíveis; não demonstra que a justificativa interpreta corretamente a regra/script. As classificações conhecidas são controles de software, não acurácia de um modelo. Não houve nova chamada real. Muitas evidências/contextos extensos podem consumir o orçamento da sessão; nesse caso a análise falha explicitamente e não omite resultados para concluir.

**Ambiente:** migração 022 aplicada após novo backup; relatório local `upgrade-022.json` contém caminho, hash do dump e contagens preservadas. A aplicação local foi parada para atualização; fixtures não usaram o banco da pesquisa.

**Rastreabilidade:** commit `[AG-12]`. **Próximo passo:** AG-13, colaboração por mensagens versionadas.

## 05/11/2026 — AG-13: esclarecimento A2 → A1 com mensagens e sessões filhas

**Estado:** concluído. Base: `77b5e41`.

**Decisão:** implementar primeiro o pedido de esclarecimento do A2 textual ao A1, com resposta consultiva. Alterar requisitos aprovados dentro da mesma análise exigiria reconstruir todas as dependências; nesta entrega, solicitar mudança bloqueia aprovação dos casos e exige nova análise, sem reaproveitar aprovações. Essa restrição foi registrada no plano antes do código. Não há patches automáticos ou delegação recursiva.

**Mudança:** A2 decide chamar request_requirement_clarification e recebe a resposta como observação. A1 consultado usa perfil fixado no snapshot e ferramentas próprias para consultar as páginas originais referenciadas pela regra e responder com IDs de fontes. O backend resolve as citações e preserva a pergunta, resposta, requisito/revisão/hash, origem e revisão humana. A resposta não substitui o requisito aprovado. Perfil A2 passa a agent/1.1.0; snapshots anteriores não recebem ferramentas novas retroativamente.

**Persistência/limites:** migração 023 cria mensagens versão 1 e sessões filhas por mensagem/tentativa. Elas compartilham posse e cancelamento da etapa solicitante, com orçamento próprio de no máximo quatro turnos/seis ferramentas e teto global da análise. Até duas solicitações por análise; repetição da mesma pergunta/revisão/unidade é idempotente. Retomada mantém leituras e consumo. Falha do consultado produz indisponibilidade explícita, não esclarecimento inventado. Durações de pai/filha não são somadas em duplicidade; tokens/chamadas de ambos são contabilizados.

**Revisão/interface:** mensagens aparecem na análise e no JSON/CSV. Resposta precisa ser reconhecida, rejeitada ou motivar revisão da regra antes da aprovação dos casos. Resposta indisponível não pode ser reconhecida. Revisão é única e auditada. Pedido de revisão bloqueia a análise anterior, preservando saídas; a interface orienta corrigir a especificação e iniciar outra. A criação seguinte não reaproveita requisitos, casos ou aprovações.

**Verificação:** 97 testes backend aprovados na suíte final, zero falhas/ignorados; sete E2E aprovados, incluindo consulta A2/A1, resposta visível e bloqueio/liberação da aprovação após revisão; lint/build frontend aprovados. Controles verificam fontes, versões, limites, falha, cancelamento e retomada sem repetir consulta/leitura nem zerar o orçamento. Um primeiro E2E usava um rótulo inexistente de botão; o seletor foi corrigido e a suíte completa passou. Provedor/executor injetados e bancos locais separados; nenhuma nova chamada real.

**Ambiente:** migração 023 aplicada após dump/cópia dos artefatos em `.local/agent-pilot/backup-qgQfJG/`; `upgrade-023.json` confirma contagens preservadas. Não se alteraram dados aprovados da pesquisa.

**Limites científicos:** a fixture obriga uma dúvida sobre entradas inválidas e devolve uma resposta programada, verificando o transporte/controle da colaboração. Não demonstra que um LLM real reconhecerá essa dúvida, escolherá consultar A1 ou produzirá esclarecimento correto. O piloto conjunto deverá observar essas decisões sem forçar o sucesso, e os julgamentos continuam dependentes de referência humana independente.

**Rastreabilidade:** commit `[AG-13]`. **Próximo passo:** AG-14, plano de execução/bundles.

## 05/11/2026 — AG-14: planos autorizados e checkpoints por bundle

**Estado:** concluído. Base: `3a1f561`.

**Problema:** uma análise aceitava somente um trabalho, com até 20 scripts e 16 fontes. A geração em lotes podia produzir mais artefatos do que o envio suportava. O desenho de plano/checkpoints foi registrado antes do código.

**Mudança:** divisão determinística em bundles válidos, com até 200 scripts por plano e sem elevar os limites individuais. Manifesto imutável registra scripts/versões/revisões/hashes, recibo e todos os trabalhos. Scripts/casos não podem ser duplicados ou omitidos; fontes divergentes no mesmo caminho são rejeitadas. Antes de cada envio, o backend confere revisão/aprovação, hashes e vínculo ao manifesto. Mudança exige outra análise, sem reaproveitar o recibo.

**Persistência/worker:** migração 024 cria planos, remove a unicidade de trabalho por análise e liga tentativas ao trabalho. Jobs históricos recebem planos de formato 0 com os próprios IDs/bundles, sem reescrever evidência. Novos planos têm formato 1. Cada bundle é um checkpoint; os três reenvios por trabalho não limitam a suíte a três bundles. Falha/repetição conserva identidade, evidências anteriores e resultados; resposta concluída não pode ser substituída. A4 aguarda todos os trabalhos. Cancelamento preserva evidência parcial.

**Interface/exportação:** manifesto autorizado visível, planos incluídos no JSON/CSV e resultados filtrados pelo respectivo trabalho, evitando repetir a suíte inteira em cada cartão. O agente 3 permanece serviço determinístico nesta entrega.

**Verificação:** 103 testes backend aprovados, zero falhas/ignorados; sete E2E aprovados; lint/build frontend aprovados. Controles específicos usam 81 scripts/cinco bundles, limites de fontes, cobertura única, falha no segundo bundle com repetição do mesmo ID, cancelamento parcial e revisão alterada sem envio. As primeiras fixtures deixaram avaliação pendente e disputaram a fila do teste seguinte; o teste passou a concluir esse processamento e os registros pendentes do banco local de testes foram cancelados antes da suíte final. Isso não envolveu o banco da pesquisa.

**Limites:** múltiplos bundles foram verificados com executor injetado, não executados como coleta científica. O teto atual de A4 é 200 resultados individuais, que não equivale necessariamente a 200 scripts. Resultados parciais cancelados não são tratados como suíte completa. A migração do ambiente existente é registrada em `upgrade-024.json`, após backup e preservação das contagens anteriores.

**Rastreabilidade:** commit `[AG-14]`. **Próximo passo:** AG-15, avaliar decisões úteis de planejamento/diagnóstico sem delegar comandos arbitrários ao LLM.

## 05/11/2026 — AG-16a: preparação do protocolo e da referência

**Estado:** preparação documental concluída; AG-16 permanece aberto, sem congelamento ou coleta principal. Base: `5c6b2ea`.

**Entrega:** rascunho do protocolo com perguntas, recorte, condições, unidades de análise, rubrica, denominadores, tratamento de falhas/intervenções e procedimento de coleta. Formulário vazio para referência humana, a ser preparado antes das saídas principais e mantido inicialmente em `.local/experimento/`, ignorado pelo Git. Não se preencheu gabarito com respostas da IA. Links do README e procedimento operacional foram atualizados; o diagrama atual passou a representar planos e vários trabalhos.

**Definições pendentes:** responsáveis pela avaliação/referência, módulo/documentos/SHAs, repetições/orçamento calibrados e decisão de manter A3 determinístico ou estudar um planejador/diagnosticador com LLM. Perguntas foram encaminhadas ao usuário enquanto o rascunho era preparado; não se tratou ausência de resposta como aceite nem se marcou AG-15/AG-16 como concluído.

**Verificação:** revisão documental dos contratos/limites atuais e conferência de que `.local/experimento/` é ignorado. Aplicação reiniciada após AG-14 com API/worker/executor e frontend; HTTP 200 em localhost:5173. Última validação de código: 103 testes backend e sete E2E aprovados, lint/build aprovados. Sem novos chamados reais ao modelo ou alterações no texto acadêmico.

**O que permite afirmar:** existe um desenho concreto para preparar a coleta, não um experimento científico já realizado. Leitura, vínculos e validações técnicas não serão usados como substitutos de precisão, cobertura semântica ou julgamento independente.

**Rastreabilidade:** commit `[AG-16a]`. **Próximo passo:** resolver o recorte de AG-15 e a referência para finalizar/congelar AG-16.

## 05/11/2026 — AG-15a: planejamento A3 com ferramentas e autorização separada

**Estado:** subetapa concluída; AG-15b/c permanecem abertas. Base: `04970b3`. O usuário escolheu implementar também A3 com LLM e informou que ainda não tem avaliador definido. O recorte foi registrado no plano antes do código; não se congelou AG-16.

**Mudança:** A3 consulta capacidades e catálogo, lê scripts/casos/fontes atribuídos, valida agrupamentos e submete plano proposto. O servidor exige leitura completa e cada script uma única vez, sem elevar os limites do protocolo. A ferramenta de validação devolve recusas que podem orientar nova decisão. Nenhuma ferramenta do planejador executa código ou altera scripts/esperados/autorizações.

**Persistência/autorização:** migração 025 separa sessões A3 por fase e cria propostas vinculadas à tentativa/entrada. Proposta fixa identidade de scripts/revisões/hashes, casos/fontes e ambiente observado. A autorização humana exige a proposta correta, confere as identidades novamente e materializa os agrupamentos validados. Depois disso o worker usa transporte determinístico, embora a configuração da análise tenha A3 agentivo. Histórico mantém chamadas/tokens por fase e teto global; retomada não zera orçamento.

**Interface/API:** opção “Planejamento de execução com ferramentas”; botão para preparar plano, proposta com lotes/justificativas e autorização posterior. Exportação inclui propostas e vínculo ao plano efetivamente autorizado. Perfis são fixados no snapshot e análises antigas mantêm o modo anterior.

**Verificação:** 107 testes backend aprovados, zero falhas/ignorados; sete E2E aprovados; lint/build aprovados. Controles verificam ordem/lotes diferentes da divisão padrão, agrupamento recusado/corrigido, retomada sem repetir leitura, ausência de jobs antes da autorização e recusa de revisão/caso/ambiente alterados. E2E completo percorre preparação, proposta, autorização, execução e A4. Provedor/executor injetados: decisões programadas demonstram controles, não utilidade de agrupamento por LLM real.

**Ambiente:** migração 025 aplicada após backup e conferência das contagens anteriores, incluindo planos e mensagens; relatório local `upgrade-025.json`. Não houve novas chamadas reais ou coleta científica.

**Rastreabilidade:** commit `[AG-15a]`. **Próximo passo:** AG-15b, diagnóstico pós-execução.

## 05/11/2026 — AG-15b: investigação pós-execução e diagnósticos A3

**Estado:** subetapa concluída. Base: `762993e`; AG-15c permanece aberta.

**Mudança:** depois de todos os bundles, novos snapshots com perfil de diagnóstico A3 enfileiram consultas sobre os resultados reais. A3 lê contextos completos de regra/fonte, caso, script/versão e ambiente, e propõe ação técnica. Contrato diferencia falha de asserção, possível problema no teste, ambiente, compatibilidade do cenário e inconclusivo. Copia esperado/observado, exige citação literal e uma conclusão por resultado; estados técnicos não podem ser classificados como falha de asserção e truncamento exige inconclusivo. Isso restringe coerência, não garante interpretação correta da causa.

**Persistência:** diagnóstico tem sessão e orçamento por fase, com teto global compartilhado. Enfileiramento registra IDs dos resultados sem copiar grandes logs na transação que persiste evidências; falha do processamento posterior não perde nem reexecuta o bundle. Contexto confere scripts/revisões/hashes contra o plano autorizado. Proposta fica em execution_proposals, com entrada/saída e revisão humana separadas. Snapshots anteriores sem esse perfil conservam o fluxo direto para A4.

**Revisão:** A4 continua examinando a evidência, sem receber o diagnóstico do A3 como gabarito. A conclusão da avaliação exige revisão do diagnóstico técnico; reconhecer/rejeitar/solicitar revisão não altera código nem autoriza novo ensaio. A interface apresenta esperado/observado e ações propostas, e registra justificativa humana.

**Verificação:** 112 testes backend aprovados, zero falhas/ignorados; seis E2E passaram na suíte inicial e o fluxo completo restante passou após corrigir um seletor, que confundia observação da tabela com sua repetição no cartão de diagnóstico. Lint/build aprovados. Controles incluem literalidade/versões, classes por estado, truncamento, leitura parcial, orçamento independente de planejamento, revisão obrigatória e retomada sem nova execução. Todos com provedor/executor injetados; não houve novo piloto real.

**Ambiente:** usa a migração 025 já aplicada; não requer migração adicional ou alteração nos dados históricos. As propostas reais desta configuração ainda não foram coletadas.

**Rastreabilidade:** commit `[AG-15b]`. **Próximo passo:** AG-15c, consulta A3 → A2 e proposta versionada de revisão do script.

## 05/11/2026 — AG-15c: retorno A3 → A2 e rascunho versionado de script

**Estado:** concluído; AG-15 encerrada em três subetapas. Base: `7f92b93`. AG-16 permanece aberto por falta de recorte/referência/avaliador e piloto conjunto.

**Mudança:** após investigar um resultado, A3 pode pedir revisão do script ao A2. A2 consultado recebe perfil próprio, sem execução ou delegação, e consulta o contexto original (regra/fontes, caso/esperado, script/versão, fontes de implementação e resultado). Pode responder sem mudança, inconclusivo ou com rascunho completo de revisão. A3 recebe a resposta como observação e pode incorporá-la à justificativa técnica, sem tratá-la como nova evidência ou aplicá-la.

**Persistência/controle:** migração 026 amplia mensagens para script_review, ligando resultado e script por FK composta, versão/revisão/hash e origem; permite sessão filha A2 na etapa solicitante. Até duas consultas de script por análise, além das duas de requisitos. Cada consulta A2 tem até seis turnos/oito ferramentas, subordinada ao teto global e ao cancelamento da fase. Mesma solicitação é idempotente, leituras/consumo são retomados, e indisponibilidade não vira sucesso inventado.

**Candidato:** preserva esperado literal e metadados base; arquivos passam pelo contrato estático existente, inclusive caminho do caso e fontes autorizadas. Rascunho guarda base e versão proposta, código e hash em artefato privado. automated_tests, aprovações, manifesto e evidência anteriores não são substituídos. Validação estática não garante que a asserção preserva semanticamente a regra; isso precisa de revisão humana. Aplicar/copiar/adaptar o código em outra análise é intervenção manual, com aprovação e autorização novas, não recuperação silenciosa da execução antiga.

**Interface/revisão:** mensagens A3/A2 mostram rascunho, esperado e justificativa; reconhecimento não aplica o código. Pedidos de revisão orientam encerrar/preservar a análise e iniciar outra. A4 só pode ser concluído depois de revisar mensagens e diagnóstico, mantendo suas próprias classificações. JSON/CSV incluem candidato e trajetórias vinculadas.

**Verificação final:** 118 testes backend aprovados, zero falhas/ignorados; oito E2E Chromium aprovados; lint/build aprovados. Controles incluem resposta e nova versão apenas proposta, script/evidência preservados, orçamento, candidato fora do escopo recusado/corrigido, indisponibilidade, cancelamento da filha, retomada sem duplicar consulta e bloqueio de conclusão sem revisão. A fixture modifica apenas um comentário para testar versionamento/transporte: não demonstra correção de defeito. Primeiro E2E expôs nome de arquivo estourando a largura móvel; houve quebra de linha no caminho. A suíte ampliada também atingiu o limite cumulativo de importações das fixtures; servidor de teste passou a usar limite próprio de 300 via injeção, mantendo padrão de produção em 30. A suíte completa passou após os ajustes.

**Ambiente:** migração 026 aplicada após backup em `.local/agent-pilot/backup-2Dsqf5/`, relatório `upgrade-026.json`, contagens anteriores preservadas (incluindo planos/propostas/mensagens). Aplicação/API/worker/executor local reiniciados; HTTP 200 no frontend. Nenhuma nova chamada real ao modelo e nenhuma coleta científica foram realizadas nesta implementação.

**Rastreabilidade:** commits `762993e` (planejamento), `7f92b93` (diagnóstico) e `[AG-15c]` (consulta/revisão). **Próximo passo:** piloto conjunto separado e fechamento de AG-16 após definir objeto e avaliação humana; a ausência de avaliador não foi preenchida com gabarito da IA.

## 05/11/2026 — AH-01: condição autônoma e elegibilidade sem aprovação humana

**Estado:** concluído. Base: `de0ba04`; a orquestração e interface ainda são as tarefas seguintes.

**Mudança:** modo assisted/v1 preservado; nova condição autonomous/v1 exige consentimento explícito, inspeção pertencente à versão, módulo compatível e recibo do executor conferido pelo servidor. O snapshot e run_grants preservam autorização de uma análise, SHA, módulo, identidade do ambiente e limites. Continuação de análise autônoma não reaproveita a autorização em outra análise.

**Separação:** processing_status registra elegibilidade técnica, conservando review_status humano pendente. A função de elegibilidade aceita admissão automática somente para análise autônoma e nunca reabilita item rejeitado. Admissão registra evento de sistema, sem criar aprovação/revisão humana. Migração 027 também estabelece eventos ordenados e snapshots imutáveis por referência/hash para o histórico posterior.

**Verificação:** 120 testes backend aprovados na verificação final; controles direcionados de consentimento, módulo, ambiente, elegibilidade e continuidade também aprovados. Uma execução anterior teve falha na fixture de continuação de A1 durante verificações sobre o mesmo banco; isolada, a fixture passou e a suíte final foi executada sem outro worker de testes backend concorrente. O banco de testes permanece separado do navegador e da pesquisa. Não houve chamada real ao modelo.

**Ambiente:** migração 027 aplicada após backup `.local/agent-pilot/backup-sjlkcT/`; relatório `upgrade-027.json` confirma preservação das contagens anteriores. Processos locais próprios foram parados para atualização; análise real não foi iniciada.

**Rastreabilidade:** commit `[AH-01]`. **Próximo passo:** AH-02, avanços automáticos sem falsificar aprovação humana.

## 05/11/2026 — AH-02: avanço autônomo sob autorização inicial

**Estado:** concluído. Base: `7c73cc3`.

**Mudança:** controlador serializa avanços por análise e recupera transições interrompidas entre checkpoints. A1, A2 textual, automação, planejamento/execução, diagnóstico e A4 avançam sem aprovação intermediária no modo autônomo. Artefatos passam pelos contratos existentes e são consumidos por elegibilidade técnica; os campos de revisão humana e propostas continuam pendentes. Execução indica origem initial_grant e não cria aceite humano fictício. Prompts identificam explicitamente a condição sem revisão humana.

**Limites:** SHA/inspeção/módulo/recibo e quantidade são conferidos novamente; ambiente diferente encerra a condição sem envio. Rejeições e validações não viram sucesso. Controle mantém análise ativa durante transições, preserva cancelamento e não aplica rascunhos de revisão. Avaliação humana de conclusões/mensagens/diagnóstico é possível após o término, sem reabrir a execução. Correção/complementação manual intermediária é recusada; novas análises exigem autorização própria.

**Verificação:** 124 testes backend aprovados na suíte final, oito E2E do modo assistido aprovados. Fixtures verificam fluxo fixo autônomo e fluxo com todos os agentes, duas consultas reais do ponto de vista do transporte, revisão humana pendente, candidatos separados, autorização por escopo, mudança de ambiente e cancelamento. Duas primeiras regressões eram mensagens de erro do modo assistido trocadas para “admitido”; a mensagem anterior foi preservada nesse modo e os testes passaram. Sem modelo/executor reais na suíte.

**O que permite afirmar:** a passagem automática está implementada e verificada tecnicamente. Não comprova qualidade semântica dos artefatos nem ganho de autonomia/colaboração por um LLM real. O histórico visual e julgamento posterior dos artefatos são as próximas tarefas.

**Rastreabilidade:** commit `[AH-02]`. **Próximo passo:** AH-03, eventos, snapshots e stream.

## 05/11/2026 — AH-03: eventos duráveis e artefatos históricos

**Estado:** concluído. Base `a6ae2aa`. Eventos do worker, sessões, turnos, ferramentas, consultas, admissões, cancelamentos e decisões humanas são registrados com ordem estável por análise. Pedido/resposta têm correlação comum; indisponibilidade é evento do sistema, sem fala inventada. Entradas, saídas normalizadas, códigos locais/globais e versões são preservados com hash, incluindo código dos scripts e alterações humanas antes/depois. Respostas tardias ficam identificadas e não são aplicadas.

**Consulta:** API paginada e detalhe com pertencimento à análise; SSE com cursor/Last-Event-ID, heartbeat e limpeza ao desconectar/terminar. JSON/CSV incluem ledger, snapshots e contagens. Histórico anterior ao ledger usa somente referências/timestamps existentes, rotulado como legado. Consultas, respostas indisponíveis, ciclos completos por par e repetições técnicas são medidas separadas; subetapas/lotes normais não contam como repetição.

**Verificação:** 128 testes backend aprovados na suíte completa. Novos testes cobrem edição posterior sem mudar snapshot antigo, escopo entre análises, paginação, legado, exportação, repetição técnica e SSE ao vivo/reconexão/cancelamento. O fluxo nativo verifica duas consultas com quatro eventos de pedido/resposta, snapshots de scripts e nenhuma repetição falsa. Fixture de provedor indisponível verifica ausência de resposta inventada. Sem chamadas a modelos ou execução real de fontes. Banco local isolado; migração 027 já aplicada na AH-01, sem nova migração nesta tarefa.

**Limites científicos:** a instrumentação permite examinar a trajetória pública e os artefatos efetivamente usados. Quantidade de mensagens não prova colaboração útil, qualidade semântica ou ganho de testes. Não expõe pensamento interno do provedor como conversa. O piloto com LLM real e a avaliação independente continuam pendentes. Rastreabilidade: commit `[AH-03]`. Próxima tarefa: AH-04, interface e julgamento posterior.

## 05/11/2026 — AH-04: acompanhamento e avaliação posterior

**Estado:** concluído. Base `dfe15c1`. A preparação oferece modo assistido/autônomo; escolher autonomia sugere todos os papéis com ferramentas. É necessário inspecionar o SHA, selecionar módulo/ambiente e marcar autorização inicial com justificativa. O servidor continua responsável por conferir esse escopo. A aba “Agentes ao vivo e histórico” é a entrada padrão das análises autônomas, com quatro papéis, sessões/consultas ativas, contagens por par, filtros e painel de mensagem/ferramenta/artefato. Eventos são deduplicados por identidade e o stream retoma pelo cursor; atualizações de estado também recarregam o resumo da análise.

**Versões e intervenção:** clicar abre o snapshot daquele momento, com hash, código, versão/revisão e mapeamentos preservados. A interface impede correção/aprovação intermediária na condição autônoma e distingue admissão de aprovação humana. Mensagens, diagnósticos e conclusões podem ser revisados após o término. `experiment_assessments` recebe julgamentos anexados sobre a execução ou snapshot, com justificativa e referência opcional; não substitui o original nem muda o resultado técnico. Julgamentos não são enviados aos agentes. A conta administrativa é o único responsável autenticado; não foi implementada identificação independente de múltiplos avaliadores.

**Dados/ambiente:** migração 028 aplicada com processos próprios parados, nenhuma análise ativa, dump/cópia de artefatos e contagens anteriores preservadas. Backup local ignorado `.local/agent-pilot/backup-l8j989/`, dump de 329544 bytes. A migração é aditiva; 027 e anteriores não foram alteradas. `atual.java` foi preservado fora do commit.

**Verificação:** 128 testes backend aprovados; nove E2E aprovados; lint/build do frontend aprovados. O novo E2E observa uma consulta A2 → A1 pendente ao vivo, depois resposta/ciclo, fluxo completo sem revisão intermediária, snapshot de script e julgamento posterior sem mudar versão ou aprovação humana. Regressões verificam que um requisito editado continua abrindo a versão original no histórico, que falha/cancelamento conservam eventos, que 104 cenários seguem gerados e que o modo assistido continua funcional. Screenshots desktop/mobile inspecionadas; largura de 390 px sem transbordamento. O primeiro E2E novo encontrou um seletor sem nome acessível exato; corrigido com rótulos explícitos e a suíte completa passou. AH-03 teve uma repetição isolada interferida por uma tarefa residual da fila de teste; a fila de fixtures foi isolada/encerrada e os testes passaram, sem alterar dados da pesquisa.

**Documentação e limites:** plano, arquitetura, protocolo e READMEs atualizados. A avaliação das saídas de cada etapa pode ocorrer toda ao final; observar só o diálogo não demonstra qualidade dos artefatos. Propostas de revisão continuam rascunhos sem aplicação/reexecução automática. Os testes novos usam fixtures, sem modelo ou execução real de fontes. Aplicação reiniciada pelo launcher local com API/worker/executor/frontend; frontend e `/api/health` responderam HTTP 200. Falta o piloto conjunto com LLM real; avaliador/referência/rubrica ainda não definidos, protocolo não congelado e sem coleta principal. Rastreabilidade: commit `[AH-04]`. Próxima atividade científica: fixar recorte e referência, executar piloto separado da coleta e depois congelar condições.

## 05/11/2026 — MV-01: falha do VVV identificada e apresentada

**Estado:** concluído. Base `dee0570`. Leitura da análise `25b7fcf7-d615-4c96-b252-2abf4304962b`: A1, dois turnos solicitados e uma ferramenta, diagnóstico preservado `ApiError`, `phase=model_turn`, HTTP 503. Não houve execução de código nessa tentativa. O registro seguro não guarda o corpo de transporte, portanto não permite distinguir sobrecarga de outra indisponibilidade do provedor. A documentação oficial descreve 503 como indisponibilidade/sobrecarga temporária, sem provar um incidente específico.

**Mudança:** API de histórico expõe diagnóstico seguro vinculado à análise/tentativa, inclusive no stream/exportação. A interface explica indisponibilidade, limite de uso, acesso recusado ou orçamento, sem exigir leitura de JSON para saber o que falhou. Retomada permanece explícita e usa o orçamento/histórico existentes; não foram adicionadas chamadas automáticas, troca de modelo ou novas autorizações. Nenhuma tentativa do VVV foi reexecutada.

**Verificação:** 12 testes de histórico/runtime aprovados em banco novo `tcc_test_agents_mv01`, incluindo 503 sem vazamento de mensagem sensível e sem retry automático. O banco de fixtures anterior tinha tarefas residuais que disputavam os claims; a execução isolada resolveu a interferência, sem tocar dados da pesquisa. Lint/build aprovados. Leitura do registro real pelo serviço novo devolveu A1/model_turn/503 e os mesmos 11 eventos. Rastreabilidade: commit `[MV-01]`. Próxima tarefa: MV-02, diagrama e reformulação visual.

## 05/11/2026 — MV-02: mapa técnico e histórico em sequência

**Estado:** concluído. Base `5041571`. A interface anterior priorizava cartões e registros; o usuário confirmou quatro nós, conexões animadas reais e modelagem técnica limpa. O painel foi substituído por mapa SVG A1–A4, com scripts no A2, estado e atividade determinísticos. Consultas são arcos distintos do fluxo previsto; sessões/consultas encerradas não animam. Falhar no A1 não marca os outros papéis como concluídos. Sessões consultadas podem trabalhar após sua própria etapa; retomar após interrupção do worker não conserva atividade de sessões antigas.

**Histórico e interação:** quatro linhas de vida com setas de pedido/resposta e artefatos clicáveis, filtros e navegação por momento. O momento histórico é rotulado e permanece sem animação; não é uma execução simulada. Painel lateral preserva snapshot/conteúdo originais, com Escape, foco e navegação por teclado. Hashes, JSON e avaliação humana são recolhidos por padrão. O julgamento posterior continua separado. O mapa se organiza em duas linhas no celular, mantendo os quatro agentes visíveis; a sequência permite rolagem horizontal. Preferência de movimento reduzido desliga as animações.

**Interface compartilhada:** superfícies neutras, títulos compactos, formulários/seletores padronizados, menos avisos/cartões repetidos e remoção do slogan do dashboard. Não houve troca de stack, biblioteca de diagrama ou ativos gerados. A fonte da atividade é o evento público/ferramenta real; não foi adicionado um LLM para inventar resumos. O novo botão de retomada exige clique e mantém justificativa/histórico existentes. Um refinamento associa o diagnóstico à tentativa da etapa atualmente falha, evitando exibir um 503 antigo como causa de falha posterior.

**Verificação:** 129 testes backend na suíte completa; cinco testes direcionados de histórico após o refinamento de escopo do diagnóstico; dez E2E; seis testes da projeção; lint/build aprovados. Os E2E cobrem consulta pendente, animação/reduced-motion, navegação temporal, snapshot após edição, julgamento, modo assistido, falha 503 com três papéis não iniciados, teclado/foco e largura de 390 px. Screenshots desktop/mobile inspecionadas. Backend em banco novo `tcc_test_agents_mv02_final`, E2E no banco separado de navegador; modelos/executor de cenários programados, sem ensaio real do VVV. Sem migração, alteração de documentos/fontes da análise ou consumo novo da API Gemini.

**O que permite afirmar:** a trajetória pública e os artefatos preservados podem ser inspecionados em mapa e sequência; estados de falha/provedor ficam mais claros. Não demonstra eficácia dos agentes, espontaneidade de consultas ou qualidade semântica. O erro real observado continua HTTP 503 no A1, antes da execução do projeto; disponibilidade do serviço externo não foi corrigida pela mudança de interface. Protocolo/piloto conjunto/avaliação independente permanecem em preparação. Aplicação reiniciada sem análises ativas: API/worker/executor/frontend operacionais e HTTP 200 em frontend/health. Rastreabilidade: commit `[MV-02]`.

## 05/11/2026 — VVV-DIAG-01: reprodução real e simulação isolada

**Estado:** investigação concluída, sem alteração de comportamento da aplicação. Base `301e798`. O usuário pediu reproduzir a chamada específica e simular o VVV. O [relatório](DIAGNOSTICO_VVV_503.md) registra entradas, isolamento, testes e limites. Reenvios de entradas iguais receberam 503 e depois 200; foi capturado JSON do endpoint do Google com `UNAVAILABLE` e alta demanda. Uma simulação separada da primeira parte concluiu listar/ler/submeter com ferramentas reais. O ensaio do worker/orquestração, em banco local novo, passou do segundo turno e falhou no terceiro, depois esgotou duas retomadas explícitas por novos 503. O terceiro turno preservado respondeu 200 posteriormente.

**Resultado e alcance:** 16 chamadas reais de geração entre controles/ensaios, dez respostas, seis 503 e 23330 tokens reportados; consumo nas falhas é desconhecido. O documento tem 13 partes; a conclusão separada da capa/sumário não é conclusão do A1 inteiro. O fluxo isolado terminou sem concluir a primeira parte e sem chegar a A2–A4 ou executar o código. A análise original manteve status, tentativa única, snapshot e horário de término. Dados completos e scripts de diagnóstico ficaram ignorados em `.local/`; o commit contém apenas documentação técnica. Um relatório intermediário do primeiro ensaio da parte foi sobrescrito pelo segundo; o log/artefatos brutos e essa limitação foram preservados no registro.

**Encaminhamento:** evidência mais forte de intermitência da inferência, sem localizar sua causa interna. Fragilidade local: falha transitória termina imediatamente a tentativa e retomadas rápidas consomem o limite. Proposta futura de backoff limitado/cancelável, com cada envio contado e política fixada; não foi implementada nem introduzida retroativamente. Não há conclusão científica de eficácia nem validação do fluxo completo do VVV. Rastreabilidade: commit `[VVV-DIAG-01]`.

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
# RT-01 — 05/11/2026 — Retentativas do provedor

Implementada política `agent_policy` 1.1.0 para novas análises agentivas: até quatro envios por turno, com esperas canceláveis de 5/10/20 segundos para HTTP 429/502/503/504. Cada envio consome orçamento cumulativo e possui `agent_step`; falha registra status seguro, consumo desconhecido e evento, sem corpo/credenciais do transporte. A espera e seu contador ficam no checkpoint; retomada após interrupção preserva o contexto e ferramentas concluídas. Uma retomada manual após falha definitiva inicia nova sequência, sem zerar os limites cumulativos.

Política 1.0.0 e snapshots sem versão continuam sem retentativas. Nenhuma análise anterior foi migrada ou retomada. O caminho `fixed/v1` mantém seu contrato. Não se implementou tratamento de Retry-After: o gateway atual não entrega esse cabeçalho ao runtime. O mapa e a sequência distinguem espera do provedor de comunicação entre agentes; a exportação preserva os eventos e contabiliza reenvios separadamente das tentativas de etapa.

Validação em PostgreSQL local `tcc_test_retry_20261105`: 22 testes de política/runtime/sessões/histórico aprovados; após ampliar o caso de cancelamento para testar retomada, 13 testes de runtime/sessões novamente aprovados. Sete testes de projeção visual, lint e build do frontend aprovados. São controles com fixtures, sem novas chamadas reais ao Gemini e sem executar o VVV original. Ainda falta observar recuperação sob indisponibilidade real do provedor; backoff não garante disponibilidade.

# UX-01 — 05/11/2026 — Entrada na jornada de análise

Leitura das páginas/componentes atuais, serviços, contratos de preparação/revisão/execução, arquitetura e testes. Menu reduzido a Início, Projetos e Análises; rotas anteriores permanecem registradas. Início prioriza análises abertas e projetos, com indicadores/relatórios secundários. Cadastro prioriza nome/repositório/descrição e mantém referência, notas e texto em opções adicionais. Preparação apresenta documentos antes da análise; configurações individuais continuam funcionais em seção avançada. Defaults científicos anteriores preservados: assistido, A1/A2 textual/A3/A4 fixos e automação agentiva; escolher autonomia continua selecionando agentes com ferramentas explicitamente. Projeto com análise aberta oferece acesso a ela e bloqueia novo início.

Estilos compartilhados padronizam fontes, botões, tabelas e espaçamento, sem biblioteca adicional. Conferidos screenshots em 1280 e 390 px; sem transbordamento horizontal. E2E novo cobre cadastro na branch padrão, documentos, início sem configurar agentes, snapshot/modo preservados, bloqueio por análise ativa e rotas legadas. Um teste E2E aprovado; lint e build aprovados (importação ociosa identificada no primeiro lint foi removida). Sem alterações no banco de pesquisa.

# RT-02 — 05/11/2026 — Prazo durante o backoff

No teste ampliado, a espera cancelável precisava propagar o motivo original do AbortController: o prazo total deve terminar como `exhausted`, e não como interrupção genérica. Ajustado o tratamento e acrescentado controle de HTTP 502 seguido de orçamento de tempo esgotado, sem novo envio. Suíte completa em banco local isolado: 135 testes aprovados, nenhum ignorado.

# UX-02 — 05/11/2026 — Progresso, decisões e execução

Cada análise agora abre no resumo, com próxima ação derivada do estado real, cinco etapas associadas aos quatro agentes, resultados observados e acesso ao mapa/sequência. Formulários de etapas futuras ficam substituídos por sua dependência. Informações de SHA, política, modos, parâmetros e dados de auditoria permanecem na configuração preservada. Navegação usa Router com bloqueio de saída para rascunhos de requisitos/casos/scripts; correções não são descartadas silenciosamente. O resumo diferencia casos com teste concluído, resultados aprovados/reprovados, erros técnicos e inconclusivos, sem converter omissão ou compilação em execução.

Automação prioriza módulo, viabilidade e seleção de casos; todos os aprovados continuam selecionados por padrão. Gerar scripts, preparar plano, complementar casos e retomar/continuar análises usam `operation_record:'system/v1'`: o servidor descreve a operação e preserva evento com origem sistema, sem gerar aprovação ou opinião humana. Clientes antigos com justificativa continuam compatíveis. Endpoints de revisão e execução não aceitam esse registro em substituição à justificativa exigida. Autorizações usam finalidade escolhida pelo usuário, confirmação explícita e escopo real; nenhuma garantia do executor foi alterada. Julgamento posterior permanece separado das saídas e está disponível também em Resultados. Motivo de rejeição de item e cancelamento pode ser escolhido conscientemente em opções predefinidas.

Validação: 135 testes de backend na suíte completa (banco local novo), seis controles de contrato/autenticação após o último refinamento; 12 testes de projeção/jornada/contagens; lint e build aprovados. Suíte E2E completa com 12 aprovados, incluindo recuperação controlada de dois 503, modos assistido/autônomo, consultas, rascunhos, autorizações, histórico/exportação e todos os 104 cenários. Após refinamentos de apresentação, três E2E de jornada/fluxo assistido novamente aprovados. A primeira rodada E2E atingiu o limite agregado de 300 requisições do IP compartilhado; o servidor exclusivo da fixture passou a injetar limite próprio de 10000, conservando 300 e demais controles no servidor normal. Desktop/mobile conferidos por screenshots; cabeçalhos de resultados extensos usam rolagem local. Página de análise foi separada em carregamento sob demanda, sem biblioteca adicional.

Sem alterações em `.env`, segredos, lockfiles, `atual.java`, código do executor ou banco de pesquisa. Nenhuma chamada real ao Gemini, reexecução do VVV original, coleta científica ou avaliação de usabilidade com participantes foi realizada. Estes testes de software não substituem piloto real/protocolo. Resumo completo e mapa de arquivos: [REFATORACAO_UX.md](REFATORACAO_UX.md). Commits apenas locais.

# VVV-DIAG-02 — 05/11/2026 — Execução real após RT-01/RT-02

Investigada a execução autônoma `05fcda61-2cac-412d-955f-b518274777b3`, iniciada às 13:12 em Brasília. O runtime fez 14 envios, obteve cinco respostas e nove 503; oito reenvios reais estão registrados. Parte 1 concluída, parte 2 falhou após quatro 503 consecutivos na submissão. As esperas 5/10/20 s e o hash idêntico comprovam funcionamento do backoff; recuperação limitada não garante disponibilidade do provedor.

Controles reais isolados: chamada simples e ferramenta mínima no modelo atual funcionaram; reenvio exato e conversa nova da parte 2 no 3.5 Flash-Lite falharam na submissão. O 3.1 Flash-Lite concluiu essa parte com as ferramentas e validações atuais, sem transferir assinaturas de outros modelos. O 2.5 Flash retornou 404; o 3.5 Flash reportou versão 3.6 e também falhou na submissão. São 13 envios diagnósticos, 20691 tokens reportados e custo desconhecido, sem interpretar como comparação científica de qualidade/confiabilidade. Não houve A2–A4, código executado ou alteração da análise. Escolha de modelo para futuras análises foi apresentada explicitamente ao usuário; configuração original preservada nesta investigação. Detalhes em `DIAGNOSTICO_VVV_503.md`.

# CFG-01 — 05/11/2026 — Modelo para novas análises

Após o usuário escolher explicitamente Gemini 3.1 Flash-Lite, alterado apenas `GEMINI_MODEL` no `.env` local ignorado, preservando os demais bytes e credenciais. Nenhuma análise ativa durante a reinicialização dos quatro serviços locais. Validado novo valor por `getGeminiModel`, frontend/API HTTP 200 e invariância de estado, modelo, SHA do snapshot e término da análise anterior do VVV. Novas análises usarão `gemini-3.1-flash-lite`; retomadas existentes preservam seu modelo. Nenhuma geração nova foi iniciada, sem custo adicional de inferência nesta configuração. Registro operacional apenas, sem alteração do protocolo científico ou evidência de piloto completo; configuração privada não entra no commit.

# A2-ID-01 — 05/11/2026 — Identidade exata de casos na automação

Piloto is-number `918097ed-bda2-48d6-aa4e-36f3fdcbc571`: A1 e casos textuais concluíram; A2 preparou escopo válido, mas em seis submissões enviou os UUIDs sem hífens, confundindo identidade com nome do arquivo. Todas foram rejeitadas corretamente; a mensagem genérica não orientou a correção. A sessão esgotou 12 turnos (57924 tokens, 132314 ms); a retomada seguinte enviou zero chamadas por orçamento cumulativo. Aqui não havia incompatibilidade do sistema-alvo com banco/GUI. A sugestão anterior de reduzir o sistema não solucionava essa falha de interação.

Novo perfil `agent/1.0.2`, `case_binding:exact-id/v1`: instrução distingue UUID de caminho, ferramentas de consulta/submissão recebem enums dos IDs exatos e caminhos autorizados derivados da entrada imutável. `createAutomationAgentTools` usa a definição congelada; perfil antigo continua sem especialização. Esquemas são copiados sem preservar aliases internos dos objetos primitivos compartilhados, evitando que enum de caminho contamine enum de ID. Nenhuma normalização silenciosa ou flexibilização da rastreabilidade. Validação recusada informa IDs esperados/recebidos e orientação sobre hífens. Saída bruta inválida é preservada; o modelo deve produzir a correção.

Validação em banco separado `tcc_test_a2_ids_20261105`: **138 testes aprovados**, nenhum ignorado, incluindo rejeição da forma compacta, feedback exato, correção em turno posterior com persistência do original recusado, schemas por tarefa e compatibilidade de perfil anterior. Testes iniciais identificaram compartilhamento de objetos de schema; corrigido antes da suíte completa. Limites, esperado, autorizações e executor não alterados. Piloto completo real separado ainda em andamento; não se atribui eficácia a fixtures. Arquivos SQL do IDE e `atual.java` intactos.

# A3-LIMIT-01 — 05/11/2026 — Limites visíveis ao modelo e feedback de paginação

O primeiro piloto completo isolado após A2-ID-01 (`b42f015c-f80f-4231-8077-b7de0c6defd5`, banco local `tcc_diag_isnumber_1793911774421`) gerou dois scripts válidos. O A2 corrigiu erros de adaptador/SHA e origem do esperado por consultas próprias, sem intervenção nas saídas. A3 recebeu capacidades, mas pediu `list_execution_scripts(limit:20)` quatro vezes, enquanto o contrato exige 1–10. A projeção Gemini removia `minimum/maximum` para compatibilidade sem repor a informação em linguagem natural; a rejeição dizia somente “inteiro inválido”. A guarda encerrou a repetição sem autorizar código. Resultado preservado: 24 chamadas, 69145 tokens reportados, uma falha 503 recuperada, zero trabalhos/evidências; fonte original inalterada.

Correção: `providerSchema` oferece projeção agentiva `bounds-description/v1`, com limites numéricos e de coleções nas descrições de campos, mantendo a forma simplificada e validação local estrita. A projeção é identificada nos metadados do turno. O caminho fixo mantém a projeção anterior. Rejeições locais de números/listas informam limites permitidos, preservando os critérios de aceitação. Schema original e registros anteriores não são reescritos; execução posterior depende do código/plataforma atual e deve ser identificada como nova condição técnica. Sem aumento de orçamento ou limite de página/bundle.

Suíte completa em `tcc_test_a3_bounds_20261105`: **139 testes aprovados**, sem ignorados. Inclui o pedido de página 20 recusado com intervalo 1–10, consulta com página 10 aceita, descrições do schema efetivamente enviadas ao provedor, enums preservados e schema original imutável. Segundo piloto real separado em andamento, não tratado como amostra científica nem como prova de qualidade.

# PAGES-01 — 05/11/2026 — Leitura parcial com retomada explícita

No segundo piloto isolado (`016a78d9-24e1-411f-b14b-f795160c0486`, `tcc_diag_isnumber_1793912038085`), A1/A2 concluíram, A3 planejou, Docker executou os dois testes e ambos passaram. O diagnóstico falhou antes de A4 porque tentou submeter após ler somente páginas iniciais dos contextos. “Consulte integralmente” não indicava quais IDs/offsets faltavam; repetiu até 63066 tokens na sessão de diagnóstico. Controle preservado: 36 chamadas, 144427 tokens reportados, uma consulta A2→A1, dois scripts, um trabalho/evidência, zero conclusões A4; fonte original inalterada.

Leitores A3/A4 agora informam `next_offset` e `read_complete` no retorno paginado. A rejeição indica registros e offsets pendentes, inclusive lacunas após leituras fora de ordem/restauração. O teto serializado inclui os novos campos; nenhum trecho é descartado nem marcado como lido automaticamente. Novas instruções: planejamento 1.0.1, diagnóstico 1.1.1, avaliação agent/1.0.1. Leitura integral permanece obrigatória e não comprova compreensão semântica.

Suíte completa de backend: **140 testes aprovados**, sem ignorados, em `tcc_test_agent_pages_20261105`. Inclui lacunas, restauração, metadados de continuação, limites serializados, autorização e validação das evidências. Terceiro piloto separado usou esta correção e encontrou cota 429, distinta de paginação. O relatório final confirmou conclusão após respostas válidas intercaladas; a observação preliminar de bloqueio foi corrigida no fechamento. Nenhuma análise de pesquisa foi alterada.

# QUOTA-01 — 05/11/2026 — RetryInfo da cota do Gemini

O terceiro controle local (`5a62261a-fd5f-4805-b2a3-7bea236fc9a2`, `tcc_diag_isnumber_1793912362524`) chegou ao diagnóstico com dois scripts e um trabalho. O provedor devolveu 429, `RESOURCE_EXHAUSTED`, declarando 15 requisições por minuto no Free Tier e espera aproximada de 55 s. A política 1.1.0 enviou tentativas antes do prazo indicado. O relatório final mostrou cinco 429 intercalados com respostas válidas e conclusão em 40 envios; não houve esgotamento definitivo nesta rodada. Não confundir essa cota com impossibilidade de teste, erro funcional ou defeito do executor.

Política 1.2.0 de novas análises acrescenta `respect_retry_after:true`. Extrai somente duração de `google.rpc.RetryInfo` do erro, sem salvar corpo/URLs/credenciais. A espera efetiva é o maior valor entre backoff e orientação do provedor, limitada a 60 s e ao prazo remanescente para RetryInfo. Espera inviável encerra sem reenviar antes do prazo. Cada envio ainda passa por beginStep e consome orçamento; tempo de espera, cancelamento e lease permanecem controlados. Espera inclui razão `provider_retry_after`; snapshots 1.0.0/1.1.0 mantêm a política anterior. Não aumentou cota da conta nem mudou limites de inferência/execução.

Validação específica de política/runtime/sessões: **21 testes aprovados** em banco novo isolado `tcc_test_provider_wait_20261105`, após a suíte de 140 aprovada no marco de paginação. No quarto controle real (`648dc579-96b4-4889-8a68-a802b359c4ef`), 429 observado e espera de 42000 ms efetivamente registrada com `delay_reason:provider_retry_after`. Conclusão conjunta ainda sendo conferida; resultado detalhado será registrado no fechamento do piloto.

# A4-LITERAL-01 — 05/11/2026 — Observação literal e fechamento conjunto

O quarto controle concluiu A3, mas A4 substituiu o observado real do runner por uma descrição do retorno esperado. A validação recusou corretamente; o feedback não orientava a correção e houve esgotamento. Novo perfil A4 `agent/1.0.2`: schema vincula IDs e observado aos valores da entrada, com limite de tamanho para enums. A validação local continua verificando os pares e rejeita paráfrases/invenções, informando os literais curtos ou campos exatos a consultar. Classificação e justificativa permanecem produzidas pelo modelo, sem aprovação humana fabricada.

Verificação: sete testes unitários de avaliação/diagnóstico e dez testes da seleção A4/integração/fluxo autônomo aprovados, estes em `tcc_test_a4_literals_20261105`. A suíte completa de 140 havia passado antes das duas últimas correções, verificadas por regressões específicas; não apresentar essa suíte como reexecutada depois delas.

Quinto piloto real isolado `93b97ec3-3e30-4d8a-85db-1cf25e063c2d`: todos os papéis concluíram, dois requisitos, dois casos, dois scripts, um trabalho Docker, dois resultados aprovados e duas propostas A4 `compatible`, com revisão humana pendente. Foram 33 envios, 107247 tokens reportados e 125933 ms de fluxo. Houve um 429 recuperado após 58000 ms informados pelo provedor; consumo dessa chamada é desconhecido. Não houve consultas entre agentes nesta rodada, nem retomada manual. A análise original permaneceu inalterada. [Inventário e limites de interpretação](PILOTO_AGENTES_CONJUNTO.md).

# EX-RENEW-01 — 05/11/2026 — Formulário bloqueado após expiração do executor

O usuário não conseguia iniciar outra análise. Diagnóstico autenticado confirmou processo ativo, mas `ready:false`: a validação feita no startup tinha aproximadamente 140 minutos, acima do TTL de uma hora. Disponibilidade de API/frontend não garantia prontidão do executor. O aviso da interface era genérico.

Renovação sob demanda após 30 minutos, em health autenticado e antes de admitir/drenar trabalhos, com probes reais e promessa compartilhada. Validade continua uma hora; identidade/política/imagens são conferidas. Falhas de limpeza/journal não são recuperadas automaticamente. Falha inicial de validação continua exigindo reinício com recuperação de journal. Nenhuma análise/autoridade do usuário foi criada ou alterada.

Onze testes do executor aprovados. Controle com recibo realmente expirado, listener separado, Docker real e cliente do backend passou a `ready:true`, validando Node/Java. Banco de pesquisa ocioso confirmado antes de reiniciar serviços; executor pronto, frontend/API HTTP 200 após reinício. [Plano, evidências e limites](PLANO_REVALIDACAO_EXECUTOR.md). Mudanças commitadas localmente, sem push. SQLs e `atual.java` preservados.

# AH-LOCK-01 — 05/11/2026 — Plano A3 retido no avanço automático

Na análise autônoma `085afeab-007e-4560-a131-dab5fa20009b`, A3 havia produzido um plano, mas a execução permanecia em `awaiting_review` sem trabalhos nem erro de workflow. Trava consultiva de sessão correspondente à análise continuava retida por backend ocioso do banco; host configurado é pooler. Não se tratava de aprovação humana necessária. A semântica de sessão usada pelo controlador depende da conservação da conexão física entre comandos; não é adequada a transaction pooling. O modo remoto não foi inspecionado administrativamente, portanto não se atribui um modo específico ao serviço só pelo hostname.

Substituída por trava transacional em conexão reservada até ROLLBACK, com novo namespace `autonomy:xact/v1:`. Falha no rollback descarta conexão. Não há inferência nem execução de testes dentro dessa transação. Operações de domínio conservam verificações e commits próprios; recuperação continua por checkpoints. O namespace antigo não é usado pelo controlador novo, sem terminar sessões remotas ou tentar desbloquear a de terceiros. O único worker local foi substituído sem etapa ativa; não misturar controladores das duas versões.

Sete testes de integração aprovados no banco isolado `tcc_test_autonomy_lock_20261105`. Regressão mantém trava antiga, simula disputa pela nova, verifica apenas uma admissão em avanço concorrente, liberação da trava, conclusão com executor de fixture e zero revisões humanas. Após recarregar os serviços, o worker existente retomou a análise real com a autorização inicial preservada: um trabalho Docker, dois resultados `passed`, diagnóstico A3 concluído e A4 em execução. Não houve edição direta de status, reset de orçamento nem repetição das chamadas concluídas. A intervenção de plataforma durante esse piloto técnico deve ser considerada ao interpretar seus resultados. [Plano e evidências](PLANO_TRAVA_AVANCO_AUTONOMO.md).

