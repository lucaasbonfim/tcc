# AH-LOCK-01 — Avanço autônomo com banco em pooler

Análise afetada: `085afeab-007e-4560-a131-dab5fa20009b`. Plano A3 produzido, nenhum trabalho criado; execução permanecia em `awaiting_review`, sem erro de workflow. A trava consultiva de sessão correspondente ao hash da análise continuava concedida ao backend PostgreSQL 77993, ocioso, enquanto o worker seguia ligado. Configuração aponta para host pooler.

Hipótese sustentada: locks de sessão adquiridos/liberados em comandos separados podem ficar em sessões físicas diferentes através do pooler. Esse uso não é compatível com transaction pooling, conforme [documentação do PgBouncer](https://www.pgbouncer.org/features.html). O bloqueio observado não é solicitação de aprovação humana nem resposta do Gemini.

- [x] Trocar a trava de sessão por trava de transação em conexão reservada, de BEGIN a ROLLBACK, sem executar inferência dentro dessa transação.
- [x] Usar namespace novo para não depender de travas de sessão legadas; substituir o único worker local antes de retomar, sem misturar controladores.
- [x] Regressão com trava legada retida, disputa concorrente e liberação da trava transacional; fluxo deve avançar uma vez, preservando autorização/revisão humana pendente.
- [x] Recarregar serviços após confirmar ausência de etapa ativa; deixar o worker retomar a análise existente por suas verificações normais.
- [x] Registrar o desfecho do bloqueio e commitar. Não editar status/saídas/orçamentos diretamente no banco, nem criar aprovação humana ou refazer chamadas concluídas.

## Implementação e validação

O namespace `autonomy:xact/v1:` é diferente do antigo `autonomy:`. A posse passa a usar `pg_try_advisory_xact_lock` em uma conexão mantida dentro de uma transação explícita. Ao sair, mesmo sem obter a trava, ROLLBACK libera a transação; falha no rollback descarta a conexão. As operações de domínio continuam em suas próprias transações e fazem as verificações de estado/autorização existentes. Não se alega atomicidade de todo o controlador: se houver interrupção, `recoverReady` retoma os checkpoints. Nenhuma inferência nem execução Docker ocorre dentro da transação da trava.

Não se encerrou sessão remota nem se tentou liberar trava pertencente a terceiros. A chave legada deixa de ser consultada. A implantação não deve manter controladores antigos e novos concorrendo: o único worker local foi encerrado e substituído quando nenhuma etapa estava em execução.

Sete testes de integração aprovados em `tcc_test_autonomy_lock_20261105`, sem ignorados. A nova regressão retém a chave legada numa conexão física, verifica avanço dos requisitos, impede avanço durante disputa pela nova chave, libera a transação, chama dois controladores em paralelo e verifica somente uma admissão dos casos/etapa de automação. Confirma ainda liberação da trava, conclusão de todo o percurso, um envio ao executor de fixture e nenhuma revisão humana criada. Não é simulação completa de um pooler; a continuidade real abaixo verifica o serviço configurado do usuário.

Após o reinício, o worker retomou automaticamente a análise existente: plano admitido pela autorização inicial, um trabalho Docker iniciado, dois resultados registrados e diagnóstico A3 em execução. Nenhuma edição direta dos status, nenhuma retomada de chamadas LLM já concluídas, nenhum julgamento ou nova autorização humana fabricados. O código da plataforma mudou durante esse piloto técnico; não tratar como coleta científica com configuração congelada.

Conferência posterior: os dois resultados são `passed`, o diagnóstico A3 terminou e o A4 iniciou. O bloqueio em `awaiting_review` foi removido sem aprovar artefatos como humano; havia zero registros de revisão. A conclusão do A4 ainda estava em andamento nesta conferência. Não se afirma que o modo de pooling remoto foi inspecionado administrativamente: host pooler e trava retida foram observados; a mudança torna o controlador independente da conservação de sessão entre comandos.

Conferência final após o commit `1ec7da1`: a análise real terminou com `status:completed`, todos os papéis concluídos, dois findings, nenhum `workflow_error` e zero revisões humanas. A revisão científica posterior continua pendente e não foi confundida com o avanço operacional. Não foi necessário iniciar outra análise.
