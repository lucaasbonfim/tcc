# Retentativas e simplificação do Requisita

Base: `main`, HEAD `bb6c870e1af53358b87709d609d01622814dc234`. Único arquivo local prévio: `atual.java`, fora do escopo. Não fazer push.

## RT-01 — Recuperação de indisponibilidade do modelo

- [x] Política versionada para novas análises: até quatro envios do mesmo turno, espera de 5, 10 e 20 segundos para HTTP 429/502/503/504. Versão anterior preserva comportamento sem retry.
- [x] Cada envio conta no orçamento e gera registro; consumo ausente permanece desconhecido. Falhas e espera são persistidas; cancelamento e lease continuam válidos. Ferramentas já concluídas não se repetem.
- [x] Exibir espera pelo provedor no acompanhamento, distinta de consulta entre agentes.
- [x] Validar recuperação, limite, cancelamento, checkpoint e compatibilidade; atualizar diário e commitar.

Escopo: runtime `agent/v1`, usado no VVV. Chamadas `fixed/v1` conservam o contrato anterior. Não retomar nem modificar a análise original do VVV.

## UX-01 — Jornada e navegação

- [x] Ler as páginas, componentes, contratos e testes indicados no prompt anexado.
- [x] Menu Início / Projetos / Análises, preservando URLs e acesso a exportações/históricos.
- [x] Início orientado a ação; cadastro com essenciais e opções adicionais; preparação por documentos, modo e ação principal.
- [x] Verificar e commitar.

## UX-02 — Acompanhamento e decisões

- [x] Próximo passo derivado dos estados reais; progresso resumido e acompanhamento detalhado dos agentes.
- [x] Revisão com detalhes sob demanda e proteção de edições; automação progressiva; autorizações e julgamentos humanos preservados.
- [x] Remover texto livre obrigatório de operações rotineiras com registro operacional claramente identificado, se o contrato permitir; nunca inventar razão humana.
- [x] Refinar resultados, textos, responsividade e estados vazios/erro.
- [x] Lint, build e E2E em banco isolado; conferir visual desktop/mobile, documentar limitações e commitar.

Invariantes: quatro agentes, scripts no A2, autorização explícita de código, modos assistido/autônomo, snapshots, revisões, evidências e exportações permanecem reais e auditáveis. Nenhum teste destrutivo no banco de pesquisa.

Execução e evidências: [REFATORACAO_UX.md](REFATORACAO_UX.md), entradas RT-01/RT-02/UX-01/UX-02 do [diário](DIARIO_IMPLEMENTACAO_AGENTES.md). LLM real e estudo científico permanecem pendências do piloto/protocolo, fora da validação com fixtures desta implementação.
