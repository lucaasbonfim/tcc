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
