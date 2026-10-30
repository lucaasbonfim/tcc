# Repetição de um processamento e avaliação acadêmica

## Preparação

1. Guarde o commit desta plataforma, lockfiles, versões Node/PostgreSQL e configuração sem segredos. Aplique `npm run migrate`; API e worker verificam as migrações/checksums antes de iniciar.
2. Faça backup do schema `research` e do diretório de artefatos. API e worker precisam do mesmo banco e armazenamento. PDFs e respostas grandes não estão contidos no backup SQL.
3. Registre modelo, limites e orçamento. Testes automatizados da plataforma não consomem Gemini. `smoke:gemini` e `smoke:automation` são verificações manuais pagas com oráculos sintéticos.
4. Escolha e registre o perfil: [Docker Desktop local](DESENVOLVIMENTO_LOCAL.md), com `npm run dev:local`, ou [VM dedicada](../executor/README.md), com provisionamento próprio. Registre imagens, deployment, política, probes e runtime; não execute fontes diretamente na API/worker/host. O modo local não deve ser descrito como VM dedicada/rootless. Sem recibo válido, registre indisponibilidade.

## Procedimento experimental implementado

1. Cadastre o projeto GitHub público, contexto e ambiente. Escolha branch/tag/SHA e confira o SHA efetivamente preservado.
2. Adicione documentos originais/versionados. Confira todas as páginas, avisos, diagramas e extrações; transcreva manualmente regras ausentes com identificação da origem.
3. Selecione explicitamente código/documentos e inicie uma nova execução. Guarde seu ID. Fontes extensas são divididas em partes com offsets/sobreposição, checkpoints e tentativas próprias; confira também a consolidação e seus alertas.
4. Revise cada requisito com justificativa; aprove/rejeite/corrija. Citação literal prova presença do trecho, sem garantir interpretação correta. Examine ambiguidades e candidatos a duplicidade/contradição.
5. Aprove a etapa e revise os casos textuais, dados, passos, esperado e requisitos. Conclua a etapa textual.
6. Na aba Scripts, inspecione o mesmo SHA, confira módulos/fontes/omissões e selecione alvos/casos aprovados. Revise importações, API, asserções e esperado de cada script gerado; correções preservam versões. Conclua a revisão. Isso ainda não autoriza execução.
7. Com executor validado, autorize explicitamente com justificativa. Confira UUID/hash do bundle, SHA, imagem, política, comandos e resultados individuais. Os testes executados devem ser os gerados; a suíte anterior não é substituto. Falha de transporte/validação não gera evidência de teste.
8. Confira a proposta do agente 4 contra requisito/caso/script/resultado e fontes. Confirme, rejeite ou marque inconclusiva com justificativa; reclassificação humana fica separada do conteúdo automático. Revise todos os itens antes de concluir.
9. Exporte JSON v2/CSV e guarde os originais. JSON inclui snapshots, instruções, entradas/saídas, partes/consolidação, arquivos dos scripts, bundle, evidências, ambiente e revisões. Baixe PDFs originais separadamente e confira hashes.
10. Repita com **nova execução** para outras condições. Edições no projeto/documentos não mudam snapshots anteriores. Para branch movida, salve outra versão de código e selecione-a explicitamente.

Etapas com falha admitem repetição justificada, até três sessões. Partes já concluídas não são repetidas; cada chamada continua auditável. Para requisitos falhos com checkpoints, use **Continuar a partir dos checkpoints**, informe a justificativa e guarde os IDs de ambas as análises. A continuação mantém os documentos/SHA/modelo/parâmetros originais, valida e reutiliza partes prontas, registra suas instruções e redivide somente o restante. O histórico anterior permanece intacto; a exportação inclui as tentativas reaproveitadas separadamente. Para mudar condições/documentos, crie uma execução independente. Jobs remotos usam UUID/hash idempotentes; interrupções não autorizam repetição silenciosa do experimento.

## Dados efetivamente disponíveis

| Dado | Origem | Interpretação permitida |
| --- | --- | --- |
| Quantidade de requisitos/casos/scripts | Itens persistidos | Volume de saída; não equivale a cobertura/correção |
| Decisões/correções humanas | Reviews e artefatos antes/depois | Intervenção auditável do pesquisador |
| Duração/tokens/modelo por chamada | Worker e resposta Gemini | Tempo da inferência e valores reportados; custo desconhecido fica nulo |
| Duração/exit code/logs/relatórios | Recibo validado do executor | Comportamento observado no ambiente/imagem registrados |
| Resultado por caso/script | Executor e adaptador | Passagem, falha, erro de teste/compilação/dependência/infraestrutura, timeout ou cancelamento |
| Proposta de classificação | Agente 4 sobre evidências | Hipótese vinculada ao cenário, sujeita à revisão humana |
| Classificação humana | Decisão/revisão com justificativa | Julgamento registrado, distinto da proposta automática |
| SHA/hashes/omissões | GitHub, armazenamento e inspeção | Identidade das entradas e alcance limitado da inspeção |

## Critérios de avaliação e limites

Contratos verificam schema, referências, citações, esperado e vínculo com requisitos/casos aprovados. Eles não substituem referência humana independente. A classificação `possible_functional_divergence` requer evidência de falha e não confirma defeito sozinha. Problemas no script, compilação, dependência, infraestrutura e observação truncada têm tratamento conservador; falha de API/parsing não é defeito funcional do projeto.

Defina previamente critérios de inclusão, protocolo de julgamento, referência humana, tratamento de discordâncias e métricas. Não existem referência ouro, precisão/recall, cobertura ou grau de confiança calibrado implementados. Um cenário aprovado não prova correção global. O suporte Java inicial não automatiza GUI nem serviços externos; pacotes e plugins npm/Maven não são instalados durante o teste.

O piloto Node local foi executado realmente com Gemini/GitHub/Docker, dois cenários sintéticos e exportação. Revisões técnicas feitas pelo assistente estão identificadas nas justificativas, sem alegar avaliação humana independente. Validação do perfil dedicado, Java e controles com defeito público deliberado continuam pendentes. Consulte [piloto e controles](PILOTO_EXECUCAO.md); não misture fixtures ou oráculos sintéticos com dados acadêmicos sem identificar sua finalidade.

Modelos podem ser não determinísticos e aliases podem mudar. Preservar prompts/parâmetros permite auditar condições, sem garantir saída idêntica. Para auditar o resultado original, use snapshots e respostas brutas exportadas.
