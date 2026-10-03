-- ============================================================
-- Projeto: Geracao de Casos de Teste com IA Generativa
-- Templates participativos dos prompts
-- ============================================================

BEGIN;

INSERT INTO prompt_versions (
    mode,
    version,
    prompt
)
VALUES (
    'SIMPLE_PROMPT',
    '2.0',
    '{{PARTICIPANT_INSTRUCTION}}

Caso de uso:

{{USE_CASE}}'
)
ON CONFLICT (mode, version) DO UPDATE
SET
    prompt = EXCLUDED.prompt;

INSERT INTO prompt_versions (
    mode,
    version,
    prompt
)
VALUES (
    'STRUCTURED_PROMPT',
    '2.0',
    'Objetivo:
{{OBJECTIVE}}

Aspectos que devem ser considerados:
{{ASPECTS}}

Cenários que devem ser contemplados:
{{SCENARIOS}}

Formato esperado:
{{OUTPUT_FORMAT}}

Outras orientações:
{{OTHER_INSTRUCTIONS}}

Caso de uso:

{{USE_CASE}}'
)
ON CONFLICT (mode, version) DO UPDATE
SET
    prompt = EXCLUDED.prompt;

COMMIT;
