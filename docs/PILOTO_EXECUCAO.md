# Piloto técnico Node e condições de reprodução

## Escolha inicial

Adaptador: `node-test/v2`, sem instalação de pacotes ou descoberta da suíte existente. Projeto público selecionado: [is-number](https://github.com/jonschlinkert/is-number/tree/98e8ff1da1a89f93d1397a24d7413ed15421c139), SHA `98e8ff1da1a89f93d1397a24d7413ed15421c139`. Seu `index.js` CommonJS expõe a função, compatível com import default dos arquivos `.test.mjs` gerados. Manifestos e fonte foram inspecionados sem executar o projeto.

O oráculo em `docs/piloto/REQUISITOS_NODE.md` é **sintético para validação técnica**, não um documento acadêmico original nem dado experimental. `npm run smoke:automation` comprovou uma geração real Gemini válida sobre esse código/commit, sem compilar/executar o script ou gravar evidências de pesquisa.

O segundo candidato, Vai&Volta, foi inspecionado no SHA `9afa820038de42c134c8c69c2b6eaddb6404ea5f`. Maven declara PostgreSQL, jBCrypt, FlatLaf, JUnit, Mockito e H2. Modelos como `Passageiro` podem ser selecionados com seu fechamento JDK/local; controladores/DAOs e Swing não são presumidos viáveis. Foram lidos 24 arquivos, com 12 candidatos omitidos explicitamente. A inspeção é parcial e deve ser revisada. Suporte Java/JUnit está implementado de forma inicial, mas imagem, compilação e runner ainda não foram validados em VM.

## Procedimento

1. Escolher o perfil: para Docker Desktop local, executar `npm run dev:local` na raiz; para VM dedicada, provisionar conforme `executor/README.md`. Conferir probes de CPU/memória/pids/rede/permissões e limpeza, política/deployment/imagens. Saúde precisa retornar `ready=true` com o perfil/hash esperados.
2. Cadastrar o projeto Node com o SHA acima, importar os requisitos sintéticos e processar/revisar requisitos e casos textuais.
3. Na aba Scripts, inspecionar o mesmo SHA, selecionar raiz e `index.js`. Gerar scripts, conferir import/API/asserções e esperado; revisar cada arquivo e concluir a etapa.
4. Na aba Execução, conferir identidade/política do executor e autorizar com justificativa. Registrar UUID do trabalho e verificar que `commands.test_file` aponta ao arquivo em `__research_generated__`, carregado pela entrada confiável Node; a suíte antiga não é descoberta.
5. Conferir ambiente imutável, comandos, limites, saída, relatórios e resultados individuais. Conferir que fontes originais continuam com seus hashes e que o contêiner foi removido.
6. Examinar a classificação do agente 4, vinculada a resultado/script/caso/requisito; confirmar, rejeitar ou marcar inconclusiva, justificando. Concluir e exportar JSON/CSV v2.
7. Para repetir, criar outra execução com as mesmas versões dos documentos e do código. Não editar a implementação analisada para satisfazer asserções.

## Controles para validar classificações

| Controle | Preparação explícita | Resultado que deve ser distinguido |
| --- | --- | --- |
| Cenário compatível | Código original e esperado correto (2 → true; NaN → false) | Passagem do cenário, sem afirmar correção global |
| Problema no teste | Em execução técnica separada, alterar uma asserção para esperado incorreto, preservando registro/justificativa da alteração | Falha no teste, sem prova automática de defeito; agente 4 confronta script e requisito |
| Defeito conhecido | Criar previamente outro projeto-piloto/commit público com defeito deliberado e especificação independente; registrar o SHA diferente | Possível divergência apoiada em asserção adequada e evidência, sujeita à confirmação humana |
| Infraestrutura ausente | Não provisionar serviço/imagem/política | Autorização bloqueada, sem teste fictício ou evidência inventada |
| Erro de teste/compilação | Em piloto técnico separado, introduzir erro controlado no script, com revisão registrada | `test_error`/`compilation_error`, sem inferência automática de defeito funcional |
| Limite/cancelamento | Em piloto isolado próprio, ultrapassar prazo ou cancelar trabalho | Estado técnico e logs parciais, limpeza obrigatória e sem conclusão funcional |

Não apresentar as fixtures dos testes unitários/E2E como esses controles reais. Não há endpoint de importação manual de “resultados reais”: evidências entram pelo cliente autenticado do executor e precisam corresponder ao trabalho/bundle/imagem autorizados.

## Estado atual

Após escolha explícita do usuário pelo Docker Desktop para desenvolvimento, o perfil `docker-desktop-dev` foi implementado e validado. Não declara VM dedicada/rootless; mantém os probes e registra runtime/perfil em evidências/exportações. O padrão `dedicated-vm` permanece estrito, e o modo local é recusado em produção.

Piloto real concluído em 30/10/2026:

| Registro | Valor |
| --- | --- |
| Projeto público | `jonschlinkert/is-number` |
| SHA | `98e8ff1da1a89f93d1397a24d7413ed15421c139` |
| Execução | `10a33dbc-8ea0-4f79-9bb4-da75a1482b84` |
| Trabalho do executor | `64099cc6-dfd1-4be8-a32f-4097405b772e` |
| Fluxo | Gemini real → dois requisitos/casos → dois scripts revisados → Docker real → agente 4 → revisão técnica → JSON/CSV |
| Resultados | `isNumber(2) === true` e `isNumber(NaN) === false`: ambos passaram |
| Tempo observado no runner | 612 ms, exit code 0; não inclui toda a preparação/geração |
| Análises | Duas propostas `compatible`, limitadas aos cenários executados |
| Perfil | `docker-desktop-dev`, `development_only=true`, Docker Desktop/cgroupfs/v2 |

Fontes/manifesto pertencem ao SHA e foram verificados independentemente pelo serviço. Somente arquivos gerados foram carregados, com comandos/caminhos, eventos e hashes preservados. Contêiner removido. A primeira resposta do agente 4 copiou o texto do RF no lugar do esperado do caso e foi rejeitada. O schema da nova chamada restringiu os esperados às opções dos casos aprovados; repetição explícita passou, sem relaxar a validação ou apagar a falha.

As revisões deste piloto foram **técnicas, realizadas pelo assistente**, identificadas nas justificativas. O documento é um oráculo sintético e não substitui julgamento humano independente do estudo. Cinco chamadas Gemini, 12.938 tokens informados ao todo, custo desconhecido (`null`). Exportações locais em `.local/desktop-pilot/export.json` e `.csv`; resumo em `summary.json`. Os mesmos resultados estão no histórico autenticado da aplicação.

Fixtures técnicas anteriores continuam separadas. **Java, perfil dedicado e controles de defeito público deliberado permanecem pendentes**; não extrapolar os dois cenários para correção/cobertura global do projeto.
