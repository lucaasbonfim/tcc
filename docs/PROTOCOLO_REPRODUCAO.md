# Repetição de um processamento e avaliação acadêmica

## Preparação

1. Guarde o commit desta plataforma, os lockfiles, versão Node/PostgreSQL e configuração do ambiente sem divulgar segredos.
2. Instale dependências com `npm ci`; aplique `npm run migrate` somente nas novas migrações. Inicie API, worker e frontend conforme o README.
3. Faça backup do schema `research` e do diretório de artefatos. Use o mesmo caminho absoluto para API/worker. A chave Gemini e a senha de banco ficam fora das exportações e do Git.
4. Confirme o modelo configurado, limites de contexto e orçamento disponível. Testes automatizados não consomem a API; `npm run smoke:gemini` é validação manual paga com conteúdo sintético.

## Procedimento experimental implementado

1. Cadastre um projeto público real, descrevendo contexto acadêmico e ambiente necessário. Escolha branch/tag/SHA e confira o SHA efetivamente registrado.
2. Adicione os documentos originais e versões. Confira **todas as páginas**, avisos de extração e diagramas manualmente. Transcreva regras que não tenham sido extraídas, identificando sua origem no texto complementar.
3. Selecione explicitamente a versão de código e os documentos. Inicie a análise; anote o identificador de execução.
4. Consulte fontes, requisitos, lacunas e alertas do agente 1. Corrija e aprove/rejeite cada item com justificativa. A existência de uma citação prova a presença do trecho, não a correção da interpretação.
5. Aprove a etapa para gerar os casos. Analise esperado, dados, passos, cenários e vínculo com requisitos; corrija e revise cada caso. Conclua a etapa textual.
6. Exporte JSON e CSV da execução e guarde os originais. O JSON inclui os textos selecionados, SHA, instruções/contratos, parâmetros, entradas/saídas, revisões e metadados por tentativa. Arquivos PDF originais podem ser baixados separadamente; o hash permite verificar sua identidade.
7. Repita com **nova execução** para outras condições. A criação de uma execução não modifica a anterior. Para usar uma branch movida com novo SHA, salve novamente o projeto e selecione a nova versão.

Na repetição de uma etapa com falha, informe justificativa. Há até três tentativas por etapa. Nova execução é necessária ao atingir o limite ou mudar documentos/condições. O snapshot de uma execução não é atualizado por edições posteriores no projeto.

## Dados efetivamente disponíveis

| Dado | Origem | Interpretação permitida |
| --- | --- | --- |
| Quantidade de requisitos/casos | Itens persistidos por execução | Volume de saídas, sem equivaler a cobertura/correção |
| Decisões e correções humanas | `reviews`, antes/depois e justificativa | Registro auditável da intervenção do pesquisador |
| Duração da tentativa | Relógio do worker | Tempo do processamento, não tempo de execução do software analisado |
| Modelo/versão, tokens e término | Resposta Gemini | Somente valores reportados, sem custo estimado inventado |
| Falhas/tentativas | Estados e erros persistidos | Disponibilidade e validade estrutural, sem prova de defeito funcional |
| SHA e hashes documentais | GitHub e SHA-256 local | Identidade das entradas preservadas |

## Critérios de avaliação e pendências

Critérios estruturais implementados: schema válido, códigos únicos, citação existente na página preservada, referência somente a requisito aprovado e revisão registrada antes de avançar. Eles não substituem um conjunto de referência humano.

Para avaliar qualidade dos requisitos/testes, o pesquisador precisa definir previamente protocolo de julgamento, referência independente, critérios de inclusão/exclusão, tratamento de discordâncias e métricas adequadas. Não há referência humana ouro ou cálculo de precisão/recall/cobertura implementados.

Execução de testes, detecção de divergências, grau de confiança e confirmação/rejeição humana de defeitos ainda **não podem ser avaliados nesta versão**, pois falta executor isolado e evidência independente. Falha na API ou no parsing não é defeito funcional do projeto. Não transforme saídas sintéticas dos testes da plataforma em dados experimentais.

O modelo pode ser não determinístico e aliases podem mudar. Preservar prompts e parâmetros permite auditar as condições, mas não garante saída idêntica. Para auditoria dos resultados originais, use o snapshot e as respostas brutas exportadas.
