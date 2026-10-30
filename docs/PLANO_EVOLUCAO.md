# Evolução da plataforma de pesquisa

## Diagnóstico do código em 30/10/2026

Esta seção registra o estado anterior à refatoração. A implementação atual está descrita em `ARQUITETURA_PESQUISA.md`.

O frontend monta `ParticipantProvider`, identificação, consentimento e perfil antes das atividades. O painel administrativo exporta dados de participantes. O backend monta rotas de participantes, grupos, casos de uso e atividades; `simplePromptGeneration.service.js` mantém uma transação PostgreSQL aberta durante a chamada remota ao Gemini. A resposta é texto livre, sem contrato de requisitos ou casos rastreáveis. Não há worker, upload de documentos, suíte automatizada ou controle versionado de aplicação das migrações.

Os scripts SQL 001–008 representavam exclusivamente o experimento anterior. Algumas seeds alteravam templates existentes. Após a refatoração, esses arquivos foram removidos a pedido do pesquisador; o histórico permanece no Git. As tabelas existentes foram preservadas no banco, e a instalação atual não depende desses scripts.

Reaproveitamento: Express, `pg`, autenticação administrativa por cookie HTTP-only/JWT/bcrypt, rate limit, configuração `@google/genai`, cliente Axios, React Router, Tailwind e componentes `Card`, `Button`, `Loading`, `ErrorMessage`. Os módulos antigos ficam preservados no código e no banco, mas deixam de ser montados nas rotas ativas. Isso evita perda de dados e mantém o histórico Git consultável.

## Sequência de implementação e commits

1. Registrar este diagnóstico e as decisões iniciais.
2. Criar schema independente `research`, migração transacional com checksum e testes de integridade em PostgreSQL.
3. Implementar projetos, resolução segura de referências públicas do GitHub para SHA e documentos versionados com extração de PDF por página.
4. Definir contratos dos agentes, persistência de tentativas, snapshots e worker PostgreSQL; implementar análise de requisitos, revisão e geração de casos textuais.
5. Trocar navegação por painel de pesquisa, com cadastro, edição, documentos, revisões, histórico e exportações.
6. Validar integração, segurança e recuperação; consolidar documentação e limitações reais.

Cada commit registra sua validação em `docs/VALIDACAO.md`. Não publicar nem modificar o histórico remoto.

## Decisões iniciais

- **Stack preservada.** Nenhum framework de agentes ou broker. Um worker Node separado busca etapas em PostgreSQL com locks, tentativas limitadas e lease. Requisições de criação retornam antes da inferência. Inferências não mantêm transações abertas.
- **Histórico imutável.** Uma execução fixa projeto, referência/SHA, documentos, texto complementar, modelo, parâmetros e instruções. Repetir uma etapa cria tentativa; nova análise cria execução. Revisões registram antes/depois e justificativa.
- **Schema paralelo.** As novas FKs e restrições não dependem do experimento anterior. Nenhum DROP ou transformação destrutiva dos dados existentes.
- **Armazenamento local privado.** PDFs, extrações, snapshots e respostas ficam em diretório configurável, fora dos arquivos públicos; PostgreSQL registra referências e hashes. Backup precisa abranger banco e diretório. A primeira versão é de um pesquisador, autenticado pelo administrador existente.
- **Documentos não confiáveis.** Limites de bytes, páginas, texto e tempo; extração PDF em processo separado com memória e prazo limitados. Sem OCR nem interpretação de diagramas. Documentos e conteúdos remotos são dados, nunca instruções ou ferramentas do modelo.
- **GitHub público somente.** Aceitar exclusivamente HTTPS em `github.com/owner/repo`; consultar `api.github.com` sem redirecionamentos nem credenciais. Registrar SHA resolvido, sem clonar, instalar ou executar o projeto.
- **Quatro responsabilidades, duas etapas inicialmente operacionais.** Requisitos e geração têm instruções, contratos e registros separados; execução e avaliação possuem estado explícito não suportado enquanto não houver executor isolado e evidências independentes. Nenhum teste textual será apresentado como executável ou resultado de execução.
- **Execução externa fechada.** Docker instalado não equivale a isolamento validado. O daemon está indisponível no diagnóstico. Não adicionar um botão que permita contornar esse bloqueio. O adaptador inicial será documentado e detectará viabilidade estática, sem rodar comandos.
- **Testes independentes da IA.** `node:test` e respostas injetadas; integração com PostgreSQL em schema de teste separado. Nenhuma chamada paga na suíte. Credenciais locais jamais entram em logs ou commits.

## Critério de entrega

Entregar a primeira base funcional definida no pedido: projeto com SHA, PDF/texto versionado, agente real configurável, revisão humana, geração persistida de casos rastreáveis e histórico/exportação JSON/CSV. A validação real com Gemini depende de credenciais e acesso ao provedor; indisponibilidade será registrada sem resultados fictícios. Execução segura e avaliação experimental permanecem explicitamente pendentes até a infraestrutura necessária existir.
