-- ============================================================
-- Controle de acesso dos participantes
-- ============================================================

BEGIN;

CREATE SEQUENCE IF NOT EXISTS participant_code_seq;

SELECT setval(
    'participant_code_seq',
    GREATEST(
        COALESCE(
            (
                SELECT MAX(SUBSTRING(code FROM 2)::BIGINT)
                FROM participants
                WHERE code ~ '^P[0-9]+$'
            ),
            0
        ),
        1
    ),
    COALESCE(
        (
            SELECT MAX(SUBSTRING(code FROM 2)::BIGINT)
            FROM participants
            WHERE code ~ '^P[0-9]+$'
        ),
        0
    ) > 0
);

CREATE TABLE IF NOT EXISTS participant_access (
    id BIGSERIAL PRIMARY KEY,

    participant_id BIGINT NOT NULL UNIQUE,

    email VARCHAR(255) NOT NULL,

    access_code_hash TEXT NOT NULL,

    access_code_created_at TIMESTAMPTZ NOT NULL,

    last_sent_at TIMESTAMPTZ,

    failed_attempts INTEGER NOT NULL DEFAULT 0,

    locked_until TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMPTZ,

    CONSTRAINT fk_participant_access_participant
        FOREIGN KEY (participant_id)
        REFERENCES participants(id)
        ON DELETE CASCADE,

    CONSTRAINT ck_participant_access_failed_attempts
        CHECK (failed_attempts >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_participant_access_email_lower
    ON participant_access (LOWER(email));

CREATE INDEX IF NOT EXISTS idx_participant_access_participant
    ON participant_access(participant_id);

COMMIT;
