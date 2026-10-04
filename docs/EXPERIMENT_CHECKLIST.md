# Checklist para Execucao do Experimento

Use este checklist antes, durante e depois da coleta.

## Antes da coleta

- [ ] Banco PostgreSQL criado e acessivel.
- [ ] Scripts SQL executados na ordem numerica da pasta `database/`.
- [ ] Backend configurado com `backend/.env`.
- [ ] Frontend configurado com `frontend/.env`.
- [ ] `GEMINI_API_KEY` configurada no backend.
- [ ] `GEMINI_MODEL` configurado no backend.
- [ ] `AUTH_SECRET` configurado no backend.
- [ ] `ADMIN_EMAIL` configurado.
- [ ] `ADMIN_PASSWORD_HASH` configurado com hash bcrypt.
- [ ] SMTP configurado no backend.
- [ ] Envio de e-mail validado.
- [ ] `FRONTEND_URL` configurado para CORS com cookies.
- [ ] Backend iniciado sem erro de conexao com o banco.
- [ ] Frontend iniciado apontando para a API correta.
- [ ] Rota `GET /api/health` respondendo `{ "status": "ok" }`.
- [ ] Casos de uso A, B e C cadastrados.
- [ ] Grupos 1, 2 e 3 cadastrados.
- [ ] Templates `SIMPLE_PROMPT` e `STRUCTURED_PROMPT` versao `2.0` cadastrados.
- [ ] Colunas `participant_input` e `final_prompt` existentes em `ai_runs`.
- [ ] Admin autenticado em `/admin/login`.
- [ ] Participantes cadastrados pelo admin usando e-mail.
- [ ] Grupos balanceados automaticamente entre Grupo 1, Grupo 2 e Grupo 3.
- [ ] Reenvio de acesso testado.
- [ ] Login do participante com e-mail e codigo validado.
- [ ] Fluxo inicial validado: login -> consentimento -> questionario de caracterizacao -> experimento.

## Durante a coleta

- [ ] Participante informou e-mail e codigo de acesso recebido por e-mail.
- [ ] Consentimento exibido corretamente antes do questionario.
- [ ] Checkbox de consentimento iniciou desmarcado.
- [ ] Botao de confirmacao permaneceu bloqueado ate o checkbox ser marcado.
- [ ] Consentimento registrado pelo participante.
- [ ] Questionario de caracterizacao exibido depois do consentimento.
- [ ] Questionario de caracterizacao preenchido antes do experimento.
- [ ] `/experiment` bloqueado antes do consentimento e do questionario.
- [ ] `/experiment/task/:id` bloqueado antes do consentimento e do questionario.
- [ ] Atividades inicializadas somente apos consentimento e perfil preenchido.
- [ ] Participante executou as atividades na ordem exibida.
- [ ] Atividade manual concluida com pelo menos um caso de teste.
- [ ] Atividade com prompt simples permitiu instrucao livre, preview e envio unico.
- [ ] Atividade com prompt estruturado permitiu formulario, preview e envio unico.
- [ ] Apos envio para IA, nenhuma atividade permitiu regeneracao.
- [ ] Administrador acompanhou progresso em `/admin`.
- [ ] Participante acessou somente os proprios dados.

## Depois da coleta

- [ ] Todos os participantes esperados aparecem em `/admin/participants`.
- [ ] Atividades concluidas aparecem com inicio, fim e duracao.
- [ ] Execucoes de IA aparecem com modelo, versao do template, entrada do participante, prompt final e tempo de resposta.
- [ ] Exportacao JSON realizada.
- [ ] Exportacao CSV realizada.
- [ ] Exportacao Excel realizada.
- [ ] Exportacoes nao incluem e-mail nem dados de autenticacao.
- [ ] Arquivos exportados armazenados em local seguro para analise.
