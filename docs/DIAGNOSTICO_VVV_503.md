# Reprodução do erro HTTP 503 no VVV

Data: 05/11/2026. Base de código: `301e798`. Investigação autorizada pelo usuário para reproduzir a chamada e simular o fluxo; não é coleta científica nem avaliação da qualidade dos agentes.

## Entradas e isolamento

- Análise original: `25b7fcf7-d615-4c96-b252-2abf4304962b`.
- Modelo: `gemini-3.5-flash-lite`, com os parâmetros preservados da análise.
- Documento: `analise_requisitos_vvv.pdf`, 92838 caracteres extraídos, organizado pela plataforma em 13 partes. A primeira tem 4886 caracteres, duas páginas e nove trechos, principalmente capa/sumário.
- Código: SHA `9afa820038de42c134c8c69c2b6eaddb6404ea5f`, módulo raiz, adaptador `java-junit/v1`.
- A reprodução direta leu as entradas imutáveis e chamou o mesmo gateway real. As respostas nativas, IDs e assinaturas foram preservados nos testes sem alteração de payload.
- A simulação do fluxo usou banco local separado, artefatos novos e os serviços reais de criação, worker, ferramentas e orquestração. O projeto/documento/inspeção foram copiados; uma nova autorização de diagnóstico foi criada no banco local. Nenhum resultado sintético foi usado como evidência de execução.
- Limites externos do diagnóstico do fluxo: 80 chamadas, 350000 tokens reportados e dez minutos; limites internos e orçamento originais também continuaram vigentes. O fluxo parou antes de atingir esses tetos, ao esgotar suas três tentativas da etapa.

## Resultados observados

| Teste | Resultado |
| --- | --- |
| Reenvio exato do segundo turno original | HTTP 503, `UNAVAILABLE`, resposta JSON do endpoint `generativelanguage.googleapis.com` |
| Primeiro turno original como controle | HTTP 200, chamada `list_document_sources` |
| Novo reenvio do mesmo segundo turno original, sem alteração | HTTP 200, chamada `read_document_sources` |
| Continuação com nova resposta nativa do primeiro turno | HTTP 200; não demonstra que a troca de resposta causou a melhora |
| Controle exploratório removendo IDs | HTTP 503; controle isolado inconclusivo, não justifica remover IDs da aplicação |
| Primeira simulação independente da primeira parte do A1 | Primeiro turno 200, segundo 503 |
| Segunda simulação independente da mesma parte | Três turnos 200: listar → ler → submeter; ferramentas e contratos reais aceitos |
| Simulação do worker/orquestração no banco separado | Primeiro e segundo turnos 200; terceiro 503; duas retomadas técnicas explícitas também receberam 503 |
| Reenvio posterior da entrada preservada desse terceiro turno | HTTP 200, chamada `submit_requirements` |

O corpo recebido nos 503 informa: **“This model is currently experiencing high demand.”** A resposta identifica `UNAVAILABLE`. Agora existe evidência direta do corpo de uma falha reproduzida, além do diagnóstico seguro da execução original. Não é apenas uma classificação deduzida pela interface.

O segundo turno original foi repetido a partir do artefato SHA-256 `c4cc1716473f59fcb15f81ee887132d842e15243dde422f96e41cd6a3a95a6c9`. O terceiro turno do teste isolado, que falhou e depois respondeu, usa entrada SHA-256 `f1004dd39cb4671284ce96ed69fec8e0f1dc458709f9f39c832b97229a766ed1`. A equivalência é da entrada preservada enviada pelo gateway; não afirma identidade de todos os cabeçalhos/roteamento internos do provedor.

A primeira parte, quando concluída separadamente, produziu zero requisitos e um alerta sobre capa/sumário. Isso se refere **somente à primeira parte**, não ao PDF inteiro. O fluxo completo precisa continuar pelas outras 12 partes e consolidar as saídas antes de formar os requisitos finais.

## Alcance da simulação

Análise de diagnóstico local: `88fa148d-30da-4d84-8e4b-5c84e4e6d90c`. Terminou com A1 falho, zero das 13 partes concluídas nesse ensaio e limite de três tentativas da etapa atingido. A2/A3/A4 não foram alcançados. Não houve scripts gerados, trabalhos enviados ao executor ou código do VVV executado. A conclusão separada da primeira parte do A1 não foi injetada nesse fluxo para fazê-lo parecer bem-sucedido.

Foram feitas 16 chamadas de geração nesta investigação: dez respostas e seis HTTP 503, incluindo controles e ensaios diferentes. O total de tokens **reportados** foi 23330; uso/custo das chamadas que falharam permanece desconhecido. Esses números não estimam taxa de indisponibilidade do serviço: a amostra é pequena, sequencial, selecionada e mistura controles distintos.

A análise original foi conferida antes/depois: continuou falha, com uma tentativa e o mesmo snapshot/horário de término. Sua condição, autorização e artefatos não foram alterados. A configuração de produção do modelo e o código da aplicação também permaneceram inalterados.

## Diagnóstico e encaminhamento

A falha não está fixada em uma única chamada inválida: entradas iguais responderam 503 e depois 200, e um ensaio avançou além do segundo turno antes de falhar no terceiro. Isso sustenta a hipótese de indisponibilidade intermitente da inferência, coerente com a resposta de alta demanda. Não identifica servidor/região/rota interna nem prova ausência de outros bugs do projeto.

Há uma fragilidade local confirmada: uma falha transitória no turno encerra a tentativa, sem espera/retentativa automática controlada. O SDK está configurado com `attempts:1`; o runtime converte a exceção em falha da etapa. Retomadas rápidas podem consumir as três tentativas sem dar tempo para a condição externa mudar. Os checkpoints conservam as leituras, mas não resolvem indisponibilidade do modelo.

Próxima melhoria proposta, **não implementada neste diagnóstico**: retentativa transitória limitada, com espera crescente e cancelável, mantendo o mesmo contexto/assinaturas e contabilizando cada envio real nos limites de chamadas, tempo e tokens desconhecidos. Registrar erro, espera e retomada no histórico; não esconder retries no SDK nem refazer ferramentas já concluídas. Especificar a política no snapshot para não alterar retrospectivamente as condições de análises anteriores. Depois, repetir o piloto completo; o funcionamento de A2–A4 com o VVV permanece sem verificação neste ensaio.

## Evidências locais

Dados completos ficam em `.local/vvv-diagnostics/`, ignorados pelo Git: `replay-report.json`, `compare-report.json`, `a1-first-part-success-report.json`, `third-turn-probe.json`, `investigation-summary.json` e `full-simulation/report.json`/`export.json`. Respostas/conteúdos privados permanecem nesse diretório e no banco local de diagnóstico. O primeiro ensaio independente que falhou também consta do log da execução do assistente e de seus artefatos brutos; seu relatório intermediário foi sobrescrito pelo segundo ensaio, limitação registrada no resumo local. Os demais relatórios citados estão preservados.

Referências de contrato: [erros da API Gemini](https://aistudio.google.com/docs/api-errors) e [function calling/assinaturas nativas](https://ai.google.dev/gemini-api/docs/generate-content/function-calling). A documentação descreve o contrato; os resultados acima vêm das chamadas efetivamente realizadas.
