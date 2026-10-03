# Checklist para Execucao do Experimento

Use este checklist antes, durante e depois da coleta.

## Antes da coleta

- [ ] Banco PostgreSQL criado e acessivel.
- [ ] Scripts SQL executados na ordem numerica da pasta `database/`.
- [ ] Backend configurado com `backend/.env`.
- [ ] Frontend configurado com `frontend/.env`.
- [ ] `GEMINI_API_KEY` configurada no backend.
- [ ] `GEMINI_MODEL` configurado no backend.
- [ ] Backend iniciado sem erro de conexao com o banco.
- [ ] Frontend iniciado apontando para a API correta.
- [ ] Rota `GET /api/health` respondendo `{ "status": "ok" }`.
- [ ] Casos de uso A, B e C cadastrados.
- [ ] Grupos 1, 2 e 3 cadastrados.
- [ ] Templates `SIMPLE_PROMPT` e `STRUCTURED_PROMPT` versao `2.0` cadastrados.
- [ ] Colunas `participant_input` e `final_prompt` existentes em `ai_runs`.
- [ ] Responsavel ciente de que `/admin` nao possui autenticacao.

## Durante a coleta

- [ ] Participante informado com codigo correto.
- [ ] Consentimento confirmado pelo participante.
- [ ] Questionario de perfil preenchido.
- [ ] Atividades inicializadas somente apos perfil preenchido.
- [ ] Participante executou as atividades na ordem exibida.
- [ ] Atividade manual concluida com pelo menos um caso de teste.
- [ ] Atividade com prompt simples permitiu instrucao livre, preview e envio unico.
- [ ] Atividade com prompt estruturado permitiu formulario, preview e envio unico.
- [ ] Apos envio para IA, nenhuma atividade permitiu regeneracao.
- [ ] Administrador acompanhou progresso em `/admin`.

## Depois da coleta

- [ ] Todos os participantes esperados aparecem em `/admin/participants`.
- [ ] Atividades concluidas aparecem com inicio, fim e duracao.
- [ ] Execucoes de IA aparecem com modelo, versao do template, entrada do participante, prompt final e tempo de resposta.
- [ ] Exportacao JSON realizada.
- [ ] Exportacao CSV realizada.
- [ ] Exportacao Excel realizada.
- [ ] Arquivos exportados armazenados em local seguro para analise.
