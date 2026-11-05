# Correção dos vínculos de casos na automação — A2-ID-01

Diagnóstico real: piloto is-number `918097ed-bda2-48d6-aa4e-36f3fdcbc571`. O agente consultou os dois casos corretamente, preparou `index.js` e submeteu seis vezes dois scripts com UUIDs sem hífens. A mensagem genérica não indicava os IDs esperados. Consumiu 12 turnos e 57924 tokens; retomada posterior não enviou novas chamadas porque o orçamento é cumulativo.

- [x] Versionar perfil do A2 com orientação explícita sobre UUID e caminho do arquivo.
- [x] Restringir ferramentas por tarefa aos IDs exatos, sem normalizar silenciosamente IDs/saídas do modelo ou aceitar vínculos externos.
- [x] Devolver diagnóstico com IDs esperados/recebidos quando uma submissão viola a identidade dos casos.
- [x] Reproduzir a rejeição real e validar correção por fixtures/persistência em banco isolado.
- [ ] Testar geração real isolada com a entrada preservada do piloto, sem alterar a análise original.
- [ ] Conferir o fluxo completo em piloto separado se o controle real de scripts passar; preservar falhas e autorizações.
- [ ] Atualizar diário, commitar a tarefa e reiniciar serviços quando estiverem ociosos.

Escopo: identidade e feedback da automação; limites, regras, esperados, autorizações e isolamento mantidos. O perfil antigo continua descrito no snapshot. Não reabrir nem editar análises históricas, não alterar os arquivos SQL abertos no IDE nem `atual.java`.
