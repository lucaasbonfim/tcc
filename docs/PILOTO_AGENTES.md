# Piloto técnico dos agentes — AG-09

Data: 04/11/2026. Primeiro marco: A2/automação com ferramentas. As demais etapas ainda usam o fluxo fixo. Registro associado ao [plano](PLANO_IMPLEMENTACAO_AGENTES.md) e ao [diário técnico](DIARIO_IMPLEMENTACAO_AGENTES.md).

Atualização de 05/11/2026: o [piloto conjunto real](PILOTO_AGENTES_CONJUNTO.md) registra a configuração posterior, com todos os papéis agentivos e execução autônoma. Este documento preserva o primeiro marco e suas condições originais.

## Finalidade e condições

Verificar o percurso operacional com Gemini, consultas a fontes reais, revisão, executor Docker e avaliação de evidências. Este piloto utiliza requisitos sintéticos sobre uma biblioteca pública. Não é coleta em projetos acadêmicos, avaliação humana independente ou evidência de superioridade multiagente.

- Repositório: `https://github.com/jonschlinkert/is-number`.
- SHA: `98e8ff1da1a89f93d1397a24d7413ed15421c139`.
- Referência técnica: [dois requisitos sintéticos já utilizados no piloto Node](piloto/REQUISITOS_NODE.md).
- Comportamentos: `isNumber(2) === true` e `isNumber(NaN) === false`.
- Modelo reportado nos turnos: `gemini-3.5-flash-lite`; parâmetros da análise preservados no snapshot.
- Execução: perfil explícito `docker-desktop-dev`; sem alegação de VM dedicada validada.
- Revisões: realizadas tecnicamente pelo assistente, com justificativas identificadas na aplicação. Scripts e resultados esperados não foram reescritos manualmente para obter passagem.

Antes da atualização do banco existente, foi confirmado que não havia análises ativas, feito dump do schema/dados `research` e copiados 263 artefatos privados. O cliente pg_dump 17 era incompatível com o servidor 18.6; foi utilizado pg_dump 18 em imagem oficial fixada. A migração 019 foi aplicada sozinha e preservou as contagens das oito entidades principais verificadas. Backups e manifestos ficam em diretório local ignorado, registrado no diário.

## Primeira análise: erro preservado

Análise `7201747c-75d1-4927-9455-c327b3779bc8`, sessão `8d5fb80f-b3a3-44a4-a99e-d289b4ccaac6`.

| Medida | Observação |
| --- | --- |
| Limite configurado | Oito turnos, 16 ferramentas, 180 segundos |
| Uso registrado | Oito turnos e oito ferramentas |
| Tokens reportados na automação | 25.179 |
| Duração da automação | 91.673 ms |
| Resultado | Falha por escopo; zero scripts persistidos |

O modelo consultou manifesto, fontes, casos e requisitos, mas passou os caminhos dos novos testes como fontes-alvo para preparar o escopo. A ferramenta recusou. A falha ocorreu por essa violação, não pelo orçamento.

Também foi observada leitura de `test.js`: o leitor anterior classificava esse nome convencional como fonte comum. A subtarefa AG-09a corrigiu a classificação para novas inspeções, preservando a inspeção e a trajetória originais. A instrução 1.0.1 passou a distinguir explicitamente caminhos de implementação de destinos dos testes. Definição e catálogo passaram a ser fixados por análise/etapa.

Exportação integral local: `.local/agent-pilot/export-eight-turns.json`. Essa análise não foi apagada, sobrescrita ou tratada como sucesso.

## Segunda análise: retomada e submissão corrigida pelo agente

Análise `d3aa93b7-f139-4f2c-bfda-75d57acd845c`, no mesmo projeto técnico e SHA. Instrução `agent/1.0.1`, leitor `2.2.0`, máximo de 12 turnos. Várias condições mudaram em relação à primeira análise; não cabe atribuir uma diferença de resultado apenas ao prompt, ao orçamento ou à classificação de fontes.

A primeira tentativa completou seis consultas e ficou sem resposta preservada no sétimo turno. A mensagem existente era genérica e a causa não pôde ser determinada retrospectivamente. O consumo desse turno permanece desconhecido. A subtarefa AG-09b acrescentou diagnóstico seguro de fase/tipo/status para falhas futuras, sem registrar mensagens sensíveis do SDK.

A repetição foi explícita, na mesma análise e com orçamento herdado. As seis consultas concluídas não foram repetidas. O agente preparou o escopo e tentou submeter os scripts usando o adaptador `node-test`; o contrato exigia `node-test/v2` e recusou a submissão. O agente consultou capacidades e corrigiu o identificador sem alterar os esperados.

| Medida | Observação acumulada da automação |
| --- | --- |
| Sessões | Duas: uma falha e uma concluída |
| Chamadas ao modelo | 11, incluindo o turno sem resposta |
| Ferramentas | Dez, incluindo uma submissão recusada |
| Tokens reportados | 37.214, contagem parcial |
| Consumo desconhecido | Sim, no turno interrompido |
| Duração registrada | 122.308 ms, somando períodos ativos das tentativas |
| Scripts válidos | Dois, versão inicial, sem edição humana do código |
| Fontes efetivas | `index.js` e manifesto necessário, fixados no SHA |

Sessões: `2cfe238d-3658-451b-8aa6-193a0cc39c34` (falha) e `d2da960d-8165-4677-aad1-da729d8f7ea2` (concluída). Exportações das tentativas e da submissão anterior à execução ficam em `.local/agent-pilot/`. Tokens da tabela são da automação agentiva, não o total de todas as etapas.

## Execução real e avaliação

Os scripts importam a implementação de `../index.js`, chamam `isNumber(2)` ou `isNumber(NaN)` e usam `assert.strictEqual` com `true` ou `false`, respectivamente. Após conferência técnica e aprovação registrada, foi autorizada a execução separadamente.

- Job: `df7aef28-7d1f-45ff-8c37-5918bd5baf8d`.
- Dois testes realmente executados e aprovados.
- Duração informada pelo executor: 367 ms, sem incluir geração, consultas ou revisão.
- Imagem Node: `sha256:0cf6ed0b8335fd776aa856441cf767fed4d1ebf1b8a5160a86c2be793262f6d3`.
- Recibo registra os 14 controles do perfil local, incluindo ausência de rede, fonte protegida, limites e ausência de segredos da aplicação.
- A4 propôs duas classificações `compatible`, vinculadas aos resultados; a conferência técnica confirmou somente os dois cenários executados.

A exportação final versão 3 está em `.local/agent-pilot/export.json`, com IDs, instruções, consultas, erros, scripts, autorização, evidência, resultados e revisões. A análise terminou como `completed`. As capturas `history-desktop.png` e `history-mobile.png` e a conferência `ui-check.json` ficam no mesmo diretório ignorado. A página real foi conferida sem erros JavaScript e sem overflow horizontal em 390 px.

## Decisões de calibração e limites

O limite padrão de criação passou de oito para 12 turnos, mantendo 16 ferramentas e 180 segundos. A trajetória observada usou dez respostas válidas e uma chamada sem resposta; o novo valor é uma escolha de engenharia apoiada neste piloto, não uma configuração otimizada estatisticamente. Snapshots existentes preservam seus limites explícitos. A estrutura da política continua versão 1.0.0; os valores efetivos e a versão do código são registrados separadamente.

A interface passa a sugerir o modo agente para novas análises; o pesquisador pode escolher o fluxo fixo. A API sem configuração explícita e as análises antigas continuam no modo fixo por compatibilidade. Os demais papéis ainda não foram convertidos neste marco.

Os casos textuais haviam recebido `manual_only` como estimativa preliminar, apesar de a execução posterior ser viável. Isso foi preservado e deve ser considerado uma limitação da classificação anterior à inspeção, não uma medição confiável de executabilidade.

O piloto demonstra consultas escolhidas pelo modelo, uso do retorno de uma ferramenta para corrigir a submissão, retomada e execução real de dois scripts. Não mede cobertura ampla, detecção de defeitos, precisão/recall, benefício causal da autonomia ou validade em sistemas Java/Swing/banco. O conjunto real da pesquisa ainda depende de referência independente e protocolo próprio.

## Repetição operacional

1. Aplicar as migrações e iniciar o ambiente local conforme o [README](../README.md).
2. Cadastrar uma cópia identificada como piloto técnico no SHA acima, usando somente os dois requisitos delimitados.
3. Criar análise no modo agente, com limites explicitamente registrados; conferir requisitos e casos antes da automação.
4. Inspecionar o commit, iniciar automação, acompanhar as consultas e preservar tentativas/erros.
5. Conferir scripts contra o oráculo técnico antes de aprovar; autorizar a execução como ação separada.
6. Conferir resultados e propostas de A4, identificar a natureza técnica da revisão e exportar JSON/CSV completo.

Não tratar repetição de uma etapa como réplica independente. Para avaliar a mudança de uma condição, criar outra análise e explicitar quais variáveis mudaram. Não reutilizar silenciosamente a referência do próprio modelo para declarar sua correção.
