# Evolução dos agentes 3 e 4 — diagnóstico e decisões

## Estado inicial verificado em 30/10/2026

O worker atual processa requisitos e casos textuais, com contratos, revisão e snapshot. `adapters.js` lê somente manifestos da raiz. Execução/avaliação são sempre `not_supported`; aprovar os casos conclui a execução textual. Artefatos usam referências com SHA-256, e revisões mantêm antes/depois. O schema `research` tem quatro etapas e não representa scripts, trabalhos de execução ou avaliações.

Baseline: 14 testes locais aprovados, três integrações ignoradas sem URL; PostgreSQL de teste local reiniciado para a continuidade. `atual.java` é um arquivo local não rastreado do usuário e será preservado. Docker Desktop/WSL estão parados e não há executor em VM dedicada validada. Não executar repositórios ou testes gerados no host/backend para contornar isso.

O GitHub público Vai&Volta foi consultado no commit `9afa820038de42c134c8c69c2b6eaddb6404ea5f`: raiz Maven, código em `src/main/java`, modelos, DAOs e telas Swing. A seleção inicial deve privilegiar classes de lógica sem GUI/banco, conferindo suas dependências; a existência de testes antigos não atende sozinha à pesquisa.

## Sequência incremental

1. Inspeção por árvore no SHA com limites e contexto de módulos Node/Java, dependências e candidatos testáveis.
2. Migração aditiva para inspeções preservadas, geração/revisão de scripts e rastreabilidade. A geração executável é uma subetapa do agente 2, sem substituir casos textuais.
3. Serviço executor independente, contrato autenticado, adaptadores de comandos fixos e contêineres sem privilégios em VM dedicada. Sem banco/Gemini no executor, sem internet durante teste, sem mounts ou socket no projeto. A saúde verifica runtime, políticas e imagens imutáveis; falta de infraestrutura mantém bloqueio.
4. Agente 3 determinístico integra trabalhos autorizados, resultados individuais, logs, cancelamento e recuperação. Fixtures são somente testes da plataforma.
5. Agente 4 recebe exclusivamente evidências do executor, contratos de referências e classificações conservadoras, seguido de revisão humana separada.
6. Documentos grandes divididos por páginas/trechos, checkpoint de partes e consolidação determinística auditável com candidatos a duplicação.
7. Interface, exportações, testes integrados e documentação atualizados conforme o código entregue.

## Limites de suporte escolhidos

- Node: arquivos JavaScript/CJS/ESM com dependências locais/builtins inspecionadas, sem instalação de pacotes nem scripts npm. Testes gerados em diretório reservado; execução explícita somente desses arquivos com `node:test`.
- Java: suporte inicial a classes selecionadas sem GUI/serviços externos e JUnit provisionado na imagem. Maven é inspecionado, não autoriza baixar dependências nem executar plugins arbitrários. Compilação/testes de módulos com dependências não provisionadas devem ser recusados ou reportar a limitação.
- Execução real não será declarada validada apenas por flags Docker ou mocks. A implantação dedicada precisa executar os probes de isolamento e o piloto antes de habilitação operacional. Sem essa infraestrutura, entregar implementação/testes do contrato e manter o estado real.
- As quatro responsabilidades lógicas continuam separadas. Uma etapa interna `automation` pertence ao agente 2; geração textual concluída pode ser estendida explicitamente, preservando execuções anteriores.

Validações e commits serão registrados em `VALIDACAO.md`; esta decisão não altera as migrações já aplicadas nem dados existentes.

## Estado entregue nesta continuação

As sete etapas acima foram implementadas, com migrações 010–014, contratos/serviço executor independentes, API/worker, interface e exportação v2. A arquitetura atual está em [ARQUITETURA_PESQUISA.md](ARQUITETURA_PESQUISA.md); o diagnóstico inicial acima é histórico. Inspeção real do Vai&Volta e geração real Gemini no piloto Node foram verificadas sem executar código externo no host.

Persistência e fluxo completo foram testados com fixtures em bancos separados. Após ligar Docker Desktop, a imagem/runner Node passou em 14 controles e dez cenários sintéticos reais. O usuário escolheu explicitamente desenvolvimento no Docker Desktop; foi acrescentado esse perfil, com launcher único e rastreabilidade local/dedicado. O piloto público Node foi então executado de ponta a ponta, incluindo Gemini e dois scripts reais. **Ainda falta validar VM dedicada, Java e os demais controles acadêmicos.** Procedimento e evidências: [PILOTO_EXECUCAO.md](PILOTO_EXECUCAO.md).
