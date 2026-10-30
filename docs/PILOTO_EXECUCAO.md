# Piloto técnico e validação pendente de infraestrutura

## Escolha inicial

Adaptador: `node-test/v2`, sem instalação de pacotes ou descoberta da suíte existente. Projeto público selecionado: [is-number](https://github.com/jonschlinkert/is-number/tree/98e8ff1da1a89f93d1397a24d7413ed15421c139), SHA `98e8ff1da1a89f93d1397a24d7413ed15421c139`. Seu `index.js` CommonJS expõe a função, compatível com import default dos arquivos `.test.mjs` gerados. Manifestos e fonte foram inspecionados sem executar o projeto.

O oráculo em `docs/piloto/REQUISITOS_NODE.md` é **sintético para validação técnica**, não um documento acadêmico original nem dado experimental. `npm run smoke:automation` comprovou uma geração real Gemini válida sobre esse código/commit, sem compilar/executar o script ou gravar evidências de pesquisa.

O segundo candidato, Vai&Volta, foi inspecionado no SHA `9afa820038de42c134c8c69c2b6eaddb6404ea5f`. Maven declara PostgreSQL, jBCrypt, FlatLaf, JUnit, Mockito e H2. Modelos como `Passageiro` podem ser selecionados com seu fechamento JDK/local; controladores/DAOs e Swing não são presumidos viáveis. Foram lidos 24 arquivos, com 12 candidatos omitidos explicitamente. A inspeção é parcial e deve ser revisada. Suporte Java/JUnit está implementado de forma inicial, mas imagem, compilação e runner ainda não foram validados em VM.

## Procedimento na infraestrutura dedicada

1. Provisionar a VM e imagens conforme `executor/README.md`; comprovar probes de CPU/memória/pids/rede/permissões e limpeza. Fixar política/deployment/imagens na API e worker. Saúde precisa retornar `ready=true` com o mesmo hash de política.
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

Geração real sobre fonte pública validada. Persistência, estados e interface do fluxo completo validados com fixtures separadas. Com Docker Desktop ligado, imagem/runner Node passaram em 14 controles reais e dez cenários técnicos, incluindo falha, erro, dependência, proteção de fontes, timeout/cancelamento e limpeza. Isso não é execução do projeto público nem evidência experimental.

**Piloto real, implantação dedicada e Java ainda pendentes.** O Docker Desktop compartilhado usa `cgroupfs` e não é rootless; o serviço recusa esse ambiente pela política atual. Nenhum recibo de saúde foi falsificado nem houve alteração para contornar o bloqueio. Esta fase ainda não cumpre o critério de execução real de ponta a ponta com repositório público.
