# Execução autônoma e histórico visual — plano antes da implementação

Data: 05/11/2026. Base: `bf0ff54`. O usuário autorizou planejar e executar esta evolução. O modo assistido existente permanece disponível; análises anteriores conservam suas condições.

## Objetivo e recorte

Permitir uma execução sem correções/aprovações humanas entre as etapas, dentro de escopo e orçamento autorizados no início. Depois de terminar ou falhar, o pesquisador examina resultados, mensagens, ferramentas e versões dos artefatos. Admissão automática significa que um artefato passou pelos controles da plataforma, não que uma pessoa o considerou correto.

O acompanhamento ao vivo e o histórico posterior usam os mesmos registros reais. Não produzir diálogo fictício, interpretar retentativa técnica como conversa nova ou abrir silenciosamente a versão atual de um artefato antigo.

Nesta entrega, a autonomia cobre a passagem entre etapas, planejamento, execução autorizada e consultas limitadas entre agentes. Propostas de revisão de script permanecem candidatos separados no histórico, sem substituir fontes/esperados nem ser executadas como uma recuperação automática. Essa limitação fica explícita no protocolo: contar mensagens/candidatos não demonstra correção de falhas ou benefício da colaboração.

## Tarefas e commits

- [x] **AH-00 — Plano.** Registrar desenho, unidades e aceites antes do código. Commit `docs(plan): planeja autonomia e historico dos agentes [AH-00]`.
- [x] **AH-01 — Condições e admissão automática.** Migração aditiva: modo da execução, elegibilidade técnica separada de revisão humana, autorização inicial imutável e eventos/snapshots. Compatibilidade com modo assistido. Não converter itens em humanamente aprovados. Verificar escopo, recusas, autoria e regressões. Commit `feat(research): separa admissao automatica e revisao humana [AH-01]`.
- [ ] **AH-02 — Orquestração autônoma.** Avançar A1 → A2 textual → automação → planejamento/execução → diagnóstico → A4, sem pausas humanas, usando a autorização inicial. Fixar SHA/inspeção/módulo/recibo/limites. Falha encerra a tentativa de forma auditável; cancelamento conserva evidências. Rascunhos ficam separados. Testar fluxo completo e recusas, sem provedor/executor reais. Commit `feat(agents): executa fluxo autonomo sob autorizacao inicial [AH-02]`.
- [ ] **AH-03 — Histórico durável e atualização ao vivo.** Registrar eventos de etapas, sessões, ferramentas, pedidos/respostas, intervenções, tentativas e artefatos com referências imutáveis. API paginada, detalhes vinculados à análise e stream com retomada/limpeza de conexão; exportar registros. Historico legado identifica suas limitações e usa somente evidências preservadas. Contar consultas, ciclos pedido/resposta e retentativas separadamente. Commit `feat(history): registra eventos e snapshots dos agentes [AH-03]`.
- [ ] **AH-04 — Interface e avaliação posterior.** Preparação do modo autônomo com autorização explícita. Visão dos agentes/estados, linha do tempo ao vivo, filtros e painel do evento/artefato. Histórico após término/falha; revisões identificadas. Julgamento posterior separado dos artefatos originais. Testar navegador, mobile, conexão/retomada e fluxo autônomo; atualizar arquitetura/protocolo/diário. Commit `feat(ui): acompanha agentes e artefatos pela linha do tempo [AH-04]`.

## Desenho operacional

1. `assisted/v1` é padrão/legado. `autonomous/v1` é uma condição nova e imutável da análise, distinta dos modos fixed/agent de cada papel.
2. Para autonomia, selecionar previamente versão/inspeção/módulo e autorizar a execução limitada. O servidor confere pertencimento/SHA, capacidades e identidade de ambiente; não confia em recibo fornecido pelo cliente. O orçamento dos agentes permanece fixado no snapshot.
3. Requisitos, casos e scripts conservam `review_status` humano. Uma condição de elegibilidade técnica separada permite consumo automático no modo autônomo. Humanamente rejeitado nunca fica elegível. Admissões e autorizações derivadas do escopo inicial têm ator/origem de sistema, sem revisões fictícias atribuídas ao pesquisador.
4. Nenhuma aprovação intermediária é necessária no modo autônomo. Os mesmos contratos de citações, cobertura declarada, escopo, scripts, bundles e evidências continuam obrigatórios. Exceder limites ou não produzir saída válida não vira sucesso nem impossibilidade inventada.
5. Fluxo termina com artefatos disponíveis para avaliação posterior, inclusive quando parcial/falho/cancelado. O julgamento humano não reescreve as saídas usadas pelos agentes nem muda retrospectivamente o resultado técnico da tentativa.

## Eventos e artefatos

- Eventos têm identidade/ordem estável, horário, análise, agente/papel, origem e vínculos de etapa/tentativa/sessão/mensagem/trabalho.
- Pedido e resposta compartilham um identificador de consulta. Uma consulta completa é um ciclo, não dois ciclos. Pergunta pendente/cancelada não conta como respondida.
- Chamadas ao modelo e ferramentas são atividades técnicas distintas das mensagens entre agentes. Reenvios/retomadas preservam sua origem e consumo.
- Snapshot aponta para conteúdo privado preservado com hash. Evento antigo abre esse conteúdo, incluindo códigos locais/globais e versões quando pertinentes, sem consultar apenas o registro atual.
- No histórico legado, distinguir timestamps/artefatos efetivamente preservados de transições que não foram registradas; não reconstruir conteúdo ou conversas inexistentes.
- Interface exibe atualização ao vivo enquanto a execução estiver ativa, mantém o histórico ao terminar e permite reconectar sem duplicar eventos.

## Verificação e registro

Cada tarefa termina com verificações pertinentes, atualização do diário, revisão do diff e commit antes da seguinte. Fixtures em bancos locais separados; não gerar custo de modelo nem executar fontes externas como parte dos testes padrão. Antes de migração no ambiente existente: parar processos próprios, verificar ausência de análise ativa, fazer dump/cópia dos artefatos e comparar contagens. Preservar `atual.java` e arquivos locais do usuário.

Aceites finais: uma execução autônoma chega a resultado/falha sem aprovações intermediárias; não há revisão humana fictícia; cancelar e repetir não duplicam evidências; mensagens exibidas correspondem a registros reais; artefato antigo conserva hash/conteúdo; contagens distinguem colaboração e falha técnica; modo assistido segue funcional. A avaliação científica permanece em preparação, sem avaliador/referência independentes definidos.
