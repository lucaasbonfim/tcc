-- ============================================================
-- Projeto: Geracao de Casos de Teste com IA Generativa
-- Armazena a entrada do participante e o prompt final enviado
-- ============================================================

ALTER TABLE ai_runs
    ADD COLUMN IF NOT EXISTS participant_input JSONB,
    ADD COLUMN IF NOT EXISTS final_prompt TEXT;
