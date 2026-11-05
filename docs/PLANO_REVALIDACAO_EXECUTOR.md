# EX-RENEW-01 — Renovação da validação do executor

Diagnóstico em 05/11/2026: `/v1/health` autenticado respondeu HTTP 200, `ready:false`, validação de `2026-11-05T21:11:29.751Z`, com aproximadamente 140 minutos de idade. O processo seguia ligado. O serviço só validava isolamento no startup e recusava trabalhos após 60 minutos. O backend mostrava um aviso genérico.

- [x] Renovar sob demanda a validação real do isolamento ao verificar ambiente ou admitir/drenar trabalhos, antecipando a validade de uma hora.
- [x] Compartilhar a renovação entre requisições concorrentes; preservar identidade, política, imagens e bloqueios por limpeza/journal.
- [x] Testar expiração, concorrência, falha de validação, recuperação do runtime e bloqueio persistente após falha de limpeza.
- [x] Reiniciar os serviços quando o banco de pesquisa estiver ocioso e verificar o recibo real pelo cliente do backend.
- [x] Documentar resultados e commitar a tarefa.

Não ampliar a validade do recibo, não substituir probes por troca de timestamp, não criar análises nem registrar autorização/julgamento pelo usuário. Os arquivos SQL e `atual.java` permanecem intactos.

## Implementação e verificação

`createExecutionService` aceita o validador real fornecido pelo servidor. Após 30 minutos, health autenticado e admissão/drenagem de trabalhos reexecutam `validateIsolation`, compartilhando a promessa entre requisições concorrentes. Após ociosidade maior que uma hora, o mesmo caminho revalida antes de anunciar prontidão ou executar código. O TTL continua em 60 minutos e datas inválidas/futuras além da tolerância são recusadas. Recibo renovado precisa corresponder à política, implantação e imagens fixadas.

Se os probes falharem, o serviço fica indisponível; nova verificação pode tentar recuperar uma falha transitória do Docker. Falha de limpeza/journal fica bloqueada no processo e não pode ser apagada pela renovação. Inicialização que falhou na validação ainda exige reinício: o servidor só habilita a renovação quando a inicialização validou e recuperou os journals antes de escutar. Não há retorno prematuro com recibo antigo em uma renovação pendente. Se os probes excederem o timeout do cliente, a interface pode exigir nova verificação após sua conclusão.

Verificações de 05/11/2026:

- Suíte completa do executor: **11 aprovados**, sem ignorados. Regressões de expiração, concorrência, revalidação antecipada por POST, falha/recuperação de probes, divergência de identidade/imagens e bloqueio persistente de limpeza.
- Controle real isolado: status expirado obtido do serviço em execução, novo listener efêmero em loopback com a mesma política e `validateIsolation` real. O cliente do backend passou de `ready:false` para `ready:true`, com uma renovação, probes Docker de Node/Java e `validated_at:2026-11-05T23:33:36.745Z`. Nenhum teste de projeto ou chamada LLM foi iniciado.
- Banco de pesquisa sem análises pendentes/em execução/aguardando revisão antes do reinício. Launcher completo reiniciado com a correção. Cliente do backend confirmou `ready:true`, Node/Java e recibo de `2026-11-05T23:33:47.404Z`; frontend e health da API responderam HTTP 200.
- Para atualizar um formulário já aberto: clicar em **Verificar ambiente autorizado**, selecionar a finalidade e marcar a autorização inicial. A verificação limpa a confirmação anterior, pois o ambiente deve ser autorizado conscientemente pelo usuário.
