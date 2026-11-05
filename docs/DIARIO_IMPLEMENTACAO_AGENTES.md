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
