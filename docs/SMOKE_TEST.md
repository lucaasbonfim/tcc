# Roteiro de Smoke Test

Execute este roteiro depois de configurar o banco, backend e frontend.

## 1. Backend

1. Acesse `GET http://localhost:3000/api/health`.
2. Confirme a resposta:

```json
{
  "status": "ok"
}
```

3. Acesse `GET http://localhost:3000/api/use-cases`.
4. Confirme que os casos A, B e C sao retornados.

## 2. Frontend do participante

1. Abra o frontend no navegador.
2. Informe um codigo de participante novo.
3. Confirme o consentimento.
4. Preencha o questionario de perfil.
5. Inicie o experimento.
6. Confirme que tres atividades aparecem em ordem.

## 3. Atividade manual

1. Abra uma atividade do modo `MANUAL`.
2. Clique em `Iniciar atividade`.
3. Cadastre um caso de teste.
4. Edite o caso de teste cadastrado.
5. Finalize a atividade.
6. Confirme que a atividade nao permite mais alteracoes.

## 4. Atividade com prompt simples

1. Abra uma atividade do modo `SIMPLE_PROMPT`.
2. Clique em `Iniciar atividade`.
3. Clique em `Gerar casos de teste`.
4. Confirme que a resposta da IA aparece na tela.
5. Finalize a atividade.

## 5. Atividade com prompt estruturado

1. Abra uma atividade do modo `STRUCTURED_PROMPT`.
2. Clique em `Iniciar atividade`.
3. Clique em `Gerar casos de teste`.
4. Confirme que a resposta da IA aparece na tela.
5. Finalize a atividade.

## 6. Area administrativa

1. Abra `/admin`.
2. Confirme que a visao geral carrega.
3. Abra `Participantes`.
4. Confirme que o participante usado no teste aparece.
5. Abra os detalhes do participante.
6. Confirme que as atividades exibem status, inicio, fim e duracao.
7. Abra `Atividades`.
8. Teste os filtros por modo e status.

## 7. Exportacoes

1. Em `/admin`, clique em `Exportar JSON`.
2. Confirme que o arquivo foi baixado.
3. Clique em `Exportar CSV`.
4. Confirme que o arquivo foi baixado.
5. Verifique se os arquivos contem participante, grupo, atividade, caso de uso, tempos e dados da IA quando aplicavel.

## Resultado esperado

- Backend responde sem erro.
- Frontend do participante completa o fluxo.
- Modos `MANUAL`, `SIMPLE_PROMPT` e `STRUCTURED_PROMPT` permanecem separados.
- Tempos de inicio, fim, duracao e resposta da IA sao registrados.
- Admin carrega dados e exporta JSON/CSV.
