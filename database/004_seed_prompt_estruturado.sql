-- ============================================================
-- Projeto: Geração de Casos de Teste com IA Generativa
-- Seed inicial do prompt estruturado
-- ============================================================

BEGIN;

INSERT INTO prompt_versions (
    mode,
    version,
    prompt
)
VALUES (
    'STRUCTURED_PROMPT',
    '1.0',
    $prompt$Você deve gerar casos de teste a partir do caso de uso fornecido.

Analise somente as informações presentes no caso de uso e não invente requisitos, regras ou comportamentos que não estejam descritos.

Os casos de teste devem considerar:
- o fluxo principal;
- os fluxos alternativos;
- as regras de negócio;
- as pré-condições;
- os resultados esperados de cada cenário.

Gere a quantidade de casos de teste necessária para representar os cenários identificados.

Para cada caso de teste, utilize obrigatoriamente o seguinte formato:

Caso de Teste [número]

Título:
[descrição curta e objetiva do cenário]

Pré-condições:
- [pré-condição]
- [pré-condição]

Passos:
1. [ação]
2. [ação]
3. [ação]

Resultado esperado:
[resultado esperado de forma clara e objetiva]

Mantenha os casos de teste claros, independentes e aderentes ao caso de uso fornecido.

Caso de uso:

{{USE_CASE}}$prompt$
)
ON CONFLICT (mode, version) DO UPDATE
SET
    prompt = EXCLUDED.prompt;

COMMIT;
