-- ============================================================
-- Projeto: Geração de Casos de Teste com IA Generativa
-- Banco: PostgreSQL
-- ============================================================


-- ============================================================
-- TIPOS
-- ============================================================

CREATE TYPE experiment_mode AS ENUM (
    'MANUAL',
    'SIMPLE_PROMPT',
    'STRUCTURED_PROMPT'
);

CREATE TYPE task_status AS ENUM (
    'PENDING',
    'IN_PROGRESS',
    'COMPLETED'
);


-- ============================================================
-- GRUPOS DO EXPERIMENTO
-- ============================================================

CREATE TABLE experiment_groups (
    id BIGSERIAL PRIMARY KEY,

    name VARCHAR(50) NOT NULL UNIQUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- ============================================================
-- PARTICIPANTES
-- ============================================================

CREATE TABLE participants (
    id BIGSERIAL PRIMARY KEY,

    code VARCHAR(20) NOT NULL UNIQUE,

    group_id BIGINT NOT NULL,

    consent_confirmed BOOLEAN NOT NULL DEFAULT FALSE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_participant_group
        FOREIGN KEY (group_id)
        REFERENCES experiment_groups(id)
);


-- ============================================================
-- PERFIL DOS PARTICIPANTES
-- Respostas do questionário de caracterização
-- ============================================================

CREATE TABLE participant_profiles (
    id BIGSERIAL PRIMARY KEY,

    participant_id BIGINT NOT NULL UNIQUE,

    course_period VARCHAR(50),

    software_dev_experience VARCHAR(50),

    software_testing_experience VARCHAR(50),

    test_case_experience VARCHAR(50),

    requirements_familiarity VARCHAR(50),

    genai_usage_frequency VARCHAR(50),

    genai_software_usage VARCHAR(100),

    genai_test_case_usage VARCHAR(50),

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_profile_participant
        FOREIGN KEY (participant_id)
        REFERENCES participants(id)
        ON DELETE CASCADE
);


-- ============================================================
-- CASOS DE USO
-- Caso A, Caso B e Caso C
-- ============================================================

CREATE TABLE use_cases (
    id BIGSERIAL PRIMARY KEY,

    code VARCHAR(10) NOT NULL UNIQUE,

    title VARCHAR(255) NOT NULL,

    content JSONB NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- ============================================================
-- CONFIGURAÇÃO DAS ATIVIDADES POR GRUPO
--
-- Exemplo:
-- Grupo 1:
-- 1 - Caso A - MANUAL
-- 2 - Caso B - SIMPLE_PROMPT
-- 3 - Caso C - STRUCTURED_PROMPT
-- ============================================================

CREATE TABLE group_tasks (
    id BIGSERIAL PRIMARY KEY,

    group_id BIGINT NOT NULL,

    use_case_id BIGINT NOT NULL,

    mode experiment_mode NOT NULL,

    task_order INTEGER NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_group_task_group
        FOREIGN KEY (group_id)
        REFERENCES experiment_groups(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_group_task_use_case
        FOREIGN KEY (use_case_id)
        REFERENCES use_cases(id),

    CONSTRAINT ck_group_task_order
        CHECK (task_order BETWEEN 1 AND 3),

    CONSTRAINT uq_group_task_order
        UNIQUE (group_id, task_order),

    CONSTRAINT uq_group_task_use_case
        UNIQUE (group_id, use_case_id),

    CONSTRAINT uq_group_task_mode
        UNIQUE (group_id, mode)
);


-- ============================================================
-- EXECUÇÃO DAS ATIVIDADES
--
-- Uma linha representa uma atividade realizada por um
-- participante durante o experimento.
-- ============================================================

CREATE TABLE experiment_tasks (
    id BIGSERIAL PRIMARY KEY,

    participant_id BIGINT NOT NULL,

    use_case_id BIGINT NOT NULL,

    mode experiment_mode NOT NULL,

    task_order INTEGER NOT NULL,

    status task_status NOT NULL DEFAULT 'PENDING',

    started_at TIMESTAMPTZ,

    finished_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMPTZ,

    CONSTRAINT fk_experiment_task_participant
        FOREIGN KEY (participant_id)
        REFERENCES participants(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_experiment_task_use_case
        FOREIGN KEY (use_case_id)
        REFERENCES use_cases(id),

    CONSTRAINT ck_experiment_task_order
        CHECK (task_order BETWEEN 1 AND 3),

    CONSTRAINT ck_experiment_task_dates
        CHECK (
            finished_at IS NULL
            OR started_at IS NULL
            OR finished_at >= started_at
        ),

    CONSTRAINT uq_participant_task_order
        UNIQUE (participant_id, task_order),

    CONSTRAINT uq_participant_use_case
        UNIQUE (participant_id, use_case_id)
);


-- ============================================================
-- VERSÕES DOS PROMPTS
--
-- Permite registrar exatamente qual prompt foi utilizado
-- durante o experimento.
-- ============================================================

CREATE TABLE prompt_versions (
    id BIGSERIAL PRIMARY KEY,

    mode experiment_mode NOT NULL,

    version VARCHAR(30) NOT NULL,

    prompt TEXT NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT ck_prompt_mode
        CHECK (
            mode IN (
                'SIMPLE_PROMPT',
                'STRUCTURED_PROMPT'
            )
        ),

    CONSTRAINT uq_prompt_version
        UNIQUE (mode, version)
);


-- ============================================================
-- EXECUÇÕES DA IA
--
-- Guarda informações da chamada realizada ao Gemini.
-- Não existe registro aqui para atividades manuais.
-- ============================================================

CREATE TABLE ai_runs (
    id BIGSERIAL PRIMARY KEY,

    experiment_task_id BIGINT NOT NULL,

    prompt_version_id BIGINT NOT NULL,

    model VARCHAR(100) NOT NULL,

    started_at TIMESTAMPTZ NOT NULL,

    finished_at TIMESTAMPTZ NOT NULL,

    response_time_ms INTEGER,

    raw_response TEXT NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_ai_run_task
        FOREIGN KEY (experiment_task_id)
        REFERENCES experiment_tasks(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_ai_run_prompt
        FOREIGN KEY (prompt_version_id)
        REFERENCES prompt_versions(id),

    CONSTRAINT ck_ai_run_dates
        CHECK (finished_at >= started_at),

    CONSTRAINT ck_ai_response_time
        CHECK (
            response_time_ms IS NULL
            OR response_time_ms >= 0
        ),

    CONSTRAINT uq_ai_run_task
        UNIQUE (experiment_task_id)
);


-- ============================================================
-- CASOS DE TESTE PRODUZIDOS
--
-- Utilizado tanto no modo manual quanto nos modos com IA.
-- ============================================================

CREATE TABLE test_cases (
    id BIGSERIAL PRIMARY KEY,

    experiment_task_id BIGINT NOT NULL,

    sequence_number INTEGER NOT NULL,

    title VARCHAR(255) NOT NULL,

    preconditions JSONB NOT NULL DEFAULT '[]'::JSONB,

    steps JSONB NOT NULL DEFAULT '[]'::JSONB,

    expected_result TEXT NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMPTZ,

    CONSTRAINT fk_test_case_task
        FOREIGN KEY (experiment_task_id)
        REFERENCES experiment_tasks(id)
        ON DELETE CASCADE,

    CONSTRAINT ck_test_case_sequence
        CHECK (sequence_number > 0),

    CONSTRAINT uq_test_case_sequence
        UNIQUE (experiment_task_id, sequence_number)
);


-- ============================================================
-- ÍNDICES
-- ============================================================

CREATE INDEX idx_participants_group
    ON participants(group_id);


CREATE INDEX idx_group_tasks_group
    ON group_tasks(group_id);


CREATE INDEX idx_group_tasks_use_case
    ON group_tasks(use_case_id);


CREATE INDEX idx_experiment_tasks_participant
    ON experiment_tasks(participant_id);


CREATE INDEX idx_experiment_tasks_status
    ON experiment_tasks(status);


CREATE INDEX idx_experiment_tasks_mode
    ON experiment_tasks(mode);


CREATE INDEX idx_test_cases_experiment_task
    ON test_cases(experiment_task_id);


CREATE INDEX idx_ai_runs_prompt_version
    ON ai_runs(prompt_version_id);