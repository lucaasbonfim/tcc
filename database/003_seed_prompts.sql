-- ============================================================
-- Projeto: Geração de Casos de Teste com IA Generativa
-- Seed inicial de prompts
-- ============================================================

BEGIN;

INSERT INTO prompt_versions (
    mode,
    version,
    prompt
)
VALUES (
    'SIMPLE_PROMPT',
    '1.0',
    'Gere casos de teste para o caso de uso a seguir:

{{USE_CASE}}'
)
ON CONFLICT (mode, version) DO UPDATE
SET
    prompt = EXCLUDED.prompt;

COMMIT;
