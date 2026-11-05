# Diagrama dos agentes e revisão da interface

05/11/2026. Base `4f83aa7`. Direção confirmada pelo usuário: diagrama técnico e limpo, quatro agentes visíveis, atividade ao vivo, conexões e histórico em sequência. A lista de registros da AH-04 não correspondeu à experiência visual esperada.

## Tarefas antes da implementação

- [x] **MV-00 — Planejar e investigar.** Conferir execução do VVV sem reexecutar modelo/código. Diagnóstico: análise `25b7fcf7-d615-4c96-b252-2abf4304962b`, A1, dois turnos solicitados/uma ferramenta, `ApiError` HTTP 503 em `model_turn`. Não houve execução do código nessa tentativa. A documentação oficial do Gemini descreve 503 como indisponibilidade/sobrecarga temporária; não há corpo detalhado salvo para afirmar a causa específica. Registrar plano e commit antes de alterar código.
- [x] **MV-01 — Falhas compreensíveis.** Expor diagnóstico seguro preservado, distinguir provedor/validação/executor e explicar ponto de parada e retomada explícita. Manter tentativa, uso desconhecido e orçamento. Verificar o caso 503 com fixture e o registro real em leitura. Sem trocar modelo, reexecutar a análise ou adicionar retries automáticos ocultos. Commit separado, com diário.
- [x] **MV-02 — Mapa e sequência.** Projetar estados a partir de eventos/etapas: não iniciado, ativo, esperando resposta, concluído, interrompido/falhou. Quatro nós fixos A1–A4, subetapa de scripts no A2. Atividade curta a partir da chamada/ferramenta real. Conexões de consultas são distintas da ordem prevista do pipeline; animar somente trabalho/consulta em andamento. Histórico em diagrama de sequência, com artefatos e mensagens clicáveis. Navegação por momento explicitamente histórica, sem simular trabalho ao vivo. Detalhes sob demanda, registros brutos recolhidos. Simplificar hierarquia, formulários e aparência compartilhada; reduzir cartões/avisos repetidos e texto promocional. Commit após validação.

## Aceites e limites

Os quatro agentes devem aparecer no primeiro painel em desktop, com alternativa legível em celular. Falhar no A1 deixa A2–A4 como não iniciados; terminar o fluxo não torna todos os agentes bem-sucedidos. Pedido e resposta mantêm vínculo e direção corretos; cancelamento/recuperação não deixam animações de sessões antigas. Artefatos históricos continuam abrindo snapshots originais. Histórico legado conserva sua limitação. Contagens não são progresso inventado nem evidência de eficácia científica.

Verificar projeção de estados, mensagens, falha/retomada e navegação histórica; navegador com stream real de fixtures, diagrama, detalhes, teclado/mobile/reduced-motion e modo assistido. Inspecionar screenshots, executar lint/build e regressões pertinentes. Cada tarefa concluída é documentada e commitada antes da seguinte. Preservar `atual.java`, dados, autorizações e `.env`; novos ensaios reais não fazem parte da validação automática.

Fonte do significado de 503: [Gemini GenerateContent API — erros](https://ai.google.dev/gemini-api/docs/generate-content/api-errors). A observação local do HTTP 503 é evidência técnica de indisponibilidade na chamada, não diagnóstico de defeito do VVV.
