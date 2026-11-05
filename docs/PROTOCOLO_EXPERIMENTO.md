# Protocolo do experimento — rascunho para fechamento

Estado em 05/11/2026: **não congelado e sem coleta principal iniciada**. Implementação até AG-15: A3 usa LLM para planejamento/diagnóstico e pode consultar A2 sobre revisão de script; execução material permanece determinística. Os novos controles foram verificados com fixtures, sem novo piloto conjunto com LLM real. Ainda não há avaliador humano definido, nem recorte/referência fechados. Este documento registra decisões propostas; não relata resultados científicos. O [diário](DIARIO_IMPLEMENTACAO_AGENTES.md) e o [piloto técnico](PILOTO_AGENTES.md) distinguem os testes de plataforma da pesquisa.

## 1. O que será investigado

Avaliar a viabilidade e a qualidade dos artefatos produzidos por agentes que analisam documentos, elaboram casos, propõem scripts e investigam evidências, com revisão humana e execução controlada. Cada agente deve ser descrito pelas decisões e ferramentas efetivamente disponíveis, sem atribuir autonomia a um serviço determinístico.

Perguntas propostas:

1. Os requisitos extraídos são corretos, sustentados pelas fontes e suficientes em relação à referência do recorte?
2. Os casos têm esperado sustentado, passos reproduzíveis e cenários relevantes, incluindo exceções/limites quando documentados?
3. Os casos considerados elegíveis podem ser automatizados e executados sem alterar suas regras ou esperados para obter aprovação?
4. As conclusões sobre execução distinguem compatibilidade, divergência possível, problema de teste, ambiente e insuficiência de evidência?
5. Que decisões de consulta/colaboração ocorreram, quais falharam e qual foi o custo observado de chamadas, tokens e tempo?

A presença de ferramentas ou mensagens não demonstra que melhoraram os resultados. A interpretação da qualidade depende da referência e da avaliação humana. Teste aprovado não prova requisito correto nem ausência de defeitos.

Para A3, registrar se houve decisão de agrupamento/ordem sustentada pelos scripts/capacidades, diagnósticos corretos e necessidade real de consultar A2. Uma fixture que força a consulta só demonstra o mecanismo. Julgar propostas de revisão antes de qualquer intervenção: candidato válido pelo contrato estático pode continuar semanticamente errado. Rascunhos não foram aplicados/executados automaticamente; copiar/adaptar uma proposta em nova análise deve ser identificado como intervenção, com nova revisão/autorização e evidência própria.

## 2. Recorte antes da coleta

Selecionar um módulo com regras verificáveis, documentação e implementação acessível em SHA fixo. Adaptadores atuais aceitam Node e Java puro/JUnit dentro dos limites registrados; não há suporte geral a Swing, banco de dados ou serviços externos. Delimitar o que ficou fora antes de observar as saídas.

O piloto com is-number usou dois requisitos sintéticos e não constitui automaticamente o objeto da coleta principal. O projeto VVV anteriormente analisado possui limitações de execução; não confundir falha de adaptação/ambiente com falha da regra.

Preencher e fixar:

| Campo | Registro necessário |
| --- | --- |
| Objeto | URL, licença quando pertinente, módulo e motivo da escolha |
| Código | SHA, caminhos incluídos/excluídos e hashes de arquivos |
| Especificação | Documentos/versões/páginas, requisitos complementares e hashes |
| Regras e cenários | Escopo da referência humana e exclusões justificadas |
| Plataforma | Commit, migrações, perfis/instruções/ferramentas e políticas efetivas |
| Modelo | Identificador configurado, versão reportada, parâmetros e orçamento |
| Executor | Perfil local/dedicado, imagem, política, probes e recibo |
| Avaliação | Responsáveis, data, rubrica e procedimento de discordância |

Mudança de código, documentos, instruções ou orçamento durante a coleta deve gerar outra condição identificada. Corrigir bugs da plataforma é permitido, mas as execuções anteriores continuam registradas e não são agrupadas silenciosamente à versão corrigida.

## 3. Referência independente da saída da IA

Preparar a referência **antes** das execuções principais. O autor/avaliador deve consultar a especificação e a implementação do recorte, sem copiar requisitos/casos propostos pela aplicação para formar o gabarito. Se usar sugestões de IA na preparação, registrar isso e exigir conferência independente; não chamar o material automaticamente de referência independente.

O modelo em [MODELO_REFERENCIA.md](MODELO_REFERENCIA.md) é um formulário vazio. Preenchê-lo é trabalho do avaliador humano. Guardar a versão preenchida inicialmente em `.local/experimento/`, ignorada pelo Git; decidir sua publicação após revisão. Fixar data e hash da versão julgada. O agente não deve recebê-la como entrada.

A referência deve conter regras atômicas, fontes, cenários com entradas/esperados e decisões de elegibilidade de automação. Registrar explicitamente lacunas: não existe esperado definitivo quando a própria especificação não o define. Para avaliar detecção de problemas, incluir controles de resultado conhecido e registrar se a origem foi defeito controlado, script incorreto, ambiente ou evidência insuficiente. Não atribuir defeito funcional somente porque uma asserção falhou.

Se houver apenas um julgador, relatar a limitação. Se houver dois, registrar julgamentos iniciais e resolver divergências com justificativa, preservando ambos; não inventar concordância ou independência.

## 4. Condições e unidade de análise

Separar claramente:

- **Saída inicial:** primeira proposta de cada etapa, antes de correções humanas.
- **Saída assistida:** versão após revisões humanas, com antes/depois, responsável, justificativa e tempo quando medido.
- **Tentativa técnica:** transporte, falha de provedor, orçamento ou retomada. Reenvio com mesmo trabalho não é novo ensaio.
- **Execução experimental:** análise iniciada com condição e entradas fixadas, incluindo seus insucessos.

Unidades: regra de referência, requisito proposto, cenário de referência, caso proposto, script/revisão e par resultado/requisito. Bundles são unidades de transporte/execução, não novas observações independentes da mesma suíte.

Para a primeira coleta, priorizar descrição do comportamento de uma configuração fixada. Repetições precisam ser definidas antes: proposta inicial de três análises por condição, sujeita à calibração de orçamento em piloto separado. Não usar essas poucas repetições como garantia de significância ou generalização.

Uma comparação fixed/v1 × agent/v1 é opcional. Só incluí-la se for possível explicitar informação disponível, instruções, modelo, orçamento, revisões e ordem das execuções. Diferenças de acesso a código/documentos ou de orçamento impedem atribuir o resultado exclusivamente à agência. Sem esse controle, apresentar viabilidade/qualidade descritivamente.

## 5. Rubrica e denominadores

| Artefato/medida | Julgamento e denominador |
| --- | --- |
| Requisito correto | Regra sustentada, escopo fiel e sem detalhe inventado; julgar cada proposta inicial |
| Precisão de requisitos | Propostas corretas / todas as propostas avaliadas; duplicadas/irrelevantes não aumentam o numerador |
| Recuperação de regras | Regras da referência cobertas corretamente / todas as regras elegíveis da referência; declarar critério de correspondência e separar acertos parciais |
| Caso válido | Esperado sustentado, passos/dados reproduzíveis e vínculo correto; casos válidos / casos avaliados |
| Cobertura de cenários | Cenários de referência representados corretamente / cenários elegíveis da referência; vínculo de requisito não basta |
| Automação | Casos com script válido e executado / casos elegíveis definidos previamente; relatar separadamente não gerado, incompatível, erro técnico e não executado |
| Resultado de execução | passed/failed/test_error/compilation_error/infraestrutura/etc., com quantidade de scripts e de resultados; não usar aprovação como acurácia |
| Avaliação A4 | Classificação proposta versus julgamento independente por par resultado/requisito; matriz de confusão quando houver referência suficiente, mantendo inconclusivos |
| Intervenção | Correções por etapa, tipo, antes/depois, tentativas e tempo efetivamente medido; não inferir minutos a partir de timestamps de espera |
| Trajetória | Chamadas/ferramentas, consultas úteis/infrutíferas, mensagens e uso da resposta; registrar também quando não houve colaboração |
| Custo/tempo | Tokens reportados e uso desconhecido; custo monetário só com tarifa fixada e cálculo documentado; duração principal sem somar a espera da sessão filha novamente |

Para correspondência de requisitos/casos, preparar uma tabela humana com código da proposta, código da referência, decisão correta/parcial/incorreta/duplicada e justificativa. Definir o tratamento de muitos-para-um antes do cálculo. Não calcular precisão/recall a partir dos próprios vínculos ou classificações da IA.

Toda taxa deve trazer numerador, denominador e exclusões. Falhas de orçamento/provedor, cancelamentos, cenários impossíveis e inconclusivos permanecem no inventário. Se uma métrica exigir um subconjunto, publicar também o total de origem e os motivos de exclusão.

## 6. Procedimento proposto

1. Fechar objeto, referência, rubrica, condições e responsáveis; guardar hashes e data de congelamento.
2. Fazer piloto técnico conjunto dos papéis escolhidos, distinto da coleta. Registrar seleção de ferramentas, eventuais consultas entre agentes, falhas e orçamento; uma troca forçada por fixture não é evidência de decisão espontânea do LLM.
3. Corrigir apenas problemas de plataforma encontrados no piloto, repetir verificações pertinentes e fixar commit/configuração. Se mudar orçamento, não misturar a execução anterior com a condição nova.
4. Executar as repetições previstas. Preservar a proposta inicial de cada etapa antes de intervir e registrar todas as correções. Não editar esperado ou implementação para transformar falha em sucesso.
5. Autorizar somente scripts revisados. Preservar manifesto, bundles e evidências por trabalho. Se houver falha de transporte, repetir o mesmo trabalho; não chamar isso de nova amostra.
6. Julgar saídas iniciais e assistidas separadamente contra a referência. Preservar conclusão proposta e classificação humana do A4.
7. Exportar JSON/CSV de cada análise, planilha humana de julgamento e inventário de falhas. Conferir cadeia documento → requisito/revisão → caso/revisão → script/revisão/hash → plano/bundle → resultado → conclusão/revisão humana.
8. Relatar números com denominadores e limitações, incluindo limitações do módulo, executor, quantidade de regras/repetições e avaliadores.

## 7. Critérios para chamar a coleta de concluída

- Referência humana identificada, revisada e fixada, com limitações declaradas.
- Objeto/SHAs/documentos e condições congelados antes das repetições principais.
- Saídas iniciais, intervenções e versões assistidas preservadas.
- Falhas e inconclusivos incluídos no inventário.
- Julgamentos humanos e correspondências disponíveis para conferir as métricas.
- Evidências exportadas e cadeia reconstruível para cada conclusão relatada.

Sem esses itens, relatar o trabalho como desenvolvimento/piloto técnico. A aprovação de testes automatizados da plataforma verifica controles do software; não substitui a avaliação científica da abordagem.
