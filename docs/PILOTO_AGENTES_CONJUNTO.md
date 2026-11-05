# Piloto conjunto real — is-number — 05/11/2026

## Resultado e finalidade

O controle final concluiu A1, A2 textual, A2 automação, A3 planejamento/execução/diagnóstico e A4 com Gemini real e executor Docker real. Dois scripts foram executados; ambos passaram. A4 propôs duas classificações `compatible`, preservando o observado literal do runner e a revisão humana pendente. Isso verifica o percurso técnico delimitado, sem demonstrar cobertura ampla, qualidade geral, superioridade multiagente ou experimento científico concluído.

O piloto original `918097ed-bda2-48d6-aa4e-36f3fdcbc571` falhava porque o A2 removia hífens dos UUIDs dos casos e recebia feedback insuficiente. Reduzir o sistema não corrigia esse defeito. Cada controle abaixo criou outra análise em banco local separado; assinatura da análise original (status, snapshot, término e tentativas) permaneceu igual antes/depois. Não houve alteração de orçamento, saídas ou julgamento da análise original.

## Entrada e configuração

- Biblioteca `jonschlinkert/is-number`, SHA `98e8ff1da1a89f93d1397a24d7413ed15421c139`; módulo raiz, adaptador `node-test/v2`.
- Entrada sintética já preservada: retornar `true` para `2` e `false` para `NaN`. Não equivale à especificação completa da biblioteca. Os textos originais contêm problemas prévios de codificação, preservados neste diagnóstico; não foram saneados para favorecer a geração.
- Modelo `gemini-3.1-flash-lite`, parâmetros copiados do snapshot original; modos `agent/v1` e `autonomous/v1`. Autorização inicial limitada ao diagnóstico; nenhum julgamento humano foi criado.
- Limites locais de contenção: 48 envios, 200000 tokens reportados, dez minutos entre verificações do processador; não são um watchdog externo de interrupção durante uma operação. Permaneceram as guardas cumulativas de cada sessão/análise. Sem retomada manual nas cinco rodadas.
- Dados derivados, relatórios, exportações e artefatos em `.local/`, ignorados pelo Git. As análises isoladas não aparecem no banco da interface de pesquisa.

## Inventário integral dos controles

Os números de tokens são os reportados nas respostas; chamadas com erro têm consumo desconhecido. Rodadas sucessivas com alterações de plataforma não são réplicas da mesma condição.

| Rodada / diretório `.local/` | Análise / banco local | Resultado e bloqueio observado | Envios / tokens reportados |
| --- | --- | --- | --- |
| Preparação / `is-number-fixed-1793911718385` | Sem análise criada | Recibo do executor expirado; serviços reiniciados antes das inferências | 0 |
| 1 / `is-number-fixed-1793911774421` | `b42f015c-f80f-4231-8077-b7de0c6defd5` / `tcc_diag_isnumber_1793911774421` | A2 gerou dois scripts; A3 repetiu página de 20 onde máximo era 10. Nenhum trabalho executado. Um 503 recuperado | 24 / 69145 |
| 2 / `is-number-fixed-1793912038084` | `016a78d9-24e1-411f-b14b-f795160c0486` / `tcc_diag_isnumber_1793912038085` | Dois testes passaram no Docker; A3 diagnóstico esgotou orçamento após leituras parciais e feedback insuficiente. Uma consulta A2→A1 registrada | 36 / 144427 |
| 3 / `is-number-fixed-1793912362523` | `5a62261a-fd5f-4805-b2a3-7bea236fc9a2` / `tcc_diag_isnumber_1793912362524` | Concluiu os quatro papéis, dois resultados e duas propostas A4. Cinco 429 intercalados com respostas válidas; política 1.1.0 enviou antes da espera indicada | 40 / 107818 |
| 4 / `is-number-fixed-1793912606259` | `648dc579-96b4-4889-8a68-a802b359c4ef` / `tcc_diag_isnumber_1793912606268` | Política 1.2.0 respeitou RetryInfo (42000 ms); A3 concluiu. A4 inventou paráfrase do observado, recusada até esgotamento | 40 / 161665 |
| 5 / `is-number-fixed-1793912827237` | `93b97ec3-3e30-4d8a-85db-1cf25e063c2d` / `tcc_diag_isnumber_1793912827238` | Conclusão conjunta com contrato A4 corrigido. Um 429 recuperado após 58000 ms; dois testes aprovados, duas propostas `compatible` | 33 / 107247 |

A hipótese preliminar de que a terceira rodada havia parado definitivamente na cota foi corrigida ao conferir seu relatório final. Preservam-se também as tentativas que falharam; a conclusão final não as substitui.

## Correções e proveniência

1. `2027aef` — A2-ID-01: IDs exatos nos schemas e feedback; UUID não é normalizado silenciosamente. Perfil automação `agent/1.0.2`.
2. `6bd6a28` — A3-LIMIT-01: limites informados nas descrições da projeção `bounds-description/v1` e nas rejeições; validação estrita preservada.
3. `b8895ee` — PAGES-01: `next_offset`, `read_complete` e registros pendentes nos leitores A3/A4. Planejamento `planning/1.0.1`, diagnóstico `diagnosis/1.1.1`.
4. `debc37d` — QUOTA-01: política 1.2.0 respeita RetryInfo, até 60 segundos e prazo restante; envios/esperas continuam contabilizados. Políticas antigas preservadas.
5. `2a95543` — A4-LITERAL-01: perfil avaliação `agent/1.0.2`, IDs/observado vinculados aos dados reais; classificação/justificativa continuam propostas do LLM. Pares e citação seguem verificados localmente.

A rodada 5 usou a árvore candidata que depois originou `2a95543`, sobre `debc37d`. O campo auxiliar `platform_head` de seu relatório conservou o rótulo preliminar `candidate-QUOTA-01-policy-1.2.0`; esse rótulo não identifica sozinho a árvore completa. Os perfis e payloads efetivos estão preservados no export. Relatórios brutos não foram reescritos para substituir essa proveniência.

Validação progressiva: suítes completas de 138, 139 e 140 testes nos três primeiros marcos; depois 21 testes específicos de política/runtime/sessões e dez da seleção de avaliação/integração/fluxo autônomo, além de sete unitários de avaliação/diagnóstico. As suítes são sobrepostas e não devem ser somadas como testes únicos. A suíte completa de 140 não foi reexecutada após os dois últimos marcos.

## Leitura do resultado final

A rodada 5 durou 125933 ms no fluxo do processador, com seis sessões (incluindo fases dos mesmos agentes), 33 envios ao modelo e 32 chamadas de ferramentas. Produziu dois requisitos, dois casos, dois scripts, um trabalho e dois resultados. Ambos registram `Node test assertion completed without failure.`. Os dois findings copiam esse observado, sem apresentá-lo como captura direta do valor de retorno. Sua compatibilidade depende também de conferir os asserts dos scripts e a referência sintética.

Nenhuma conversa entre agentes foi solicitada nesta rodada; há zero consultas e zero ciclos pedido/resposta. Assim, esta rodada verifica operação conjunta e uso de ferramentas, mas não comprova colaboração espontânea, benefício das conversas ou necessidade dos quatro papéis. A rodada 2 preserva uma consulta; não substituir análise qualitativa por contagem.

Nenhum avaliador humano independente foi definido e nenhum julgamento humano foi registrado. Antes da coleta principal, fechar recorte, referência independente, critérios/métricas, condições e repetições; congelar commit/configuração. Ver [protocolo](PROTOCOLO_EXPERIMENTO.md). Para usar as correções na interface, criar uma nova análise: o histórico que já consumiu orçamento continua preservado.

Fechamento operacional: confirmado que não havia análises pendentes/em execução/aguardando revisão no banco de pesquisa antes de reiniciar o launcher local. API, worker, executor e frontend reiniciados com o código atualizado; frontend em `http://localhost:5173` e health da API responderam HTTP 200. Nenhum push realizado; arquivos SQL do IDE, `atual.java` e credenciais preservados.
