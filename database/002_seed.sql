-- ============================================================
-- Projeto: Geração de Casos de Teste com IA Generativa
-- Seed inicial do experimento
-- ============================================================

BEGIN;


-- ============================================================
-- GRUPOS EXPERIMENTAIS
-- ============================================================

INSERT INTO experiment_groups (name)
VALUES
    ('Grupo 1'),
    ('Grupo 2'),
    ('Grupo 3')
ON CONFLICT (name) DO NOTHING;


-- ============================================================
-- CASO A - REALIZAR EMPRÉSTIMO DE EXEMPLAR
-- ============================================================

INSERT INTO use_cases (
    code,
    title,
    content
)
VALUES (
    'A',
    'Realizar empréstimo de exemplar',
    '{
        "objective": "Permitir que um usuário realize o empréstimo de um exemplar disponível na biblioteca.",
        "main_actor": "Usuário da biblioteca",
        "preconditions": [
            "O usuário deve estar autenticado no sistema.",
            "O usuário deve possuir cadastro ativo na biblioteca."
        ],
        "main_flow": [
            "O usuário consulta um exemplar no sistema.",
            "O sistema apresenta o exemplar e sua disponibilidade.",
            "O usuário solicita o empréstimo.",
            "O sistema verifica se o usuário possui pendências.",
            "O sistema verifica se o usuário atingiu o limite máximo de empréstimos.",
            "O sistema registra o empréstimo.",
            "O sistema informa a data prevista para devolução e confirma a operação."
        ],
        "alternative_flows": [
            {
                "code": "FA01",
                "title": "Exemplar indisponível",
                "description": "No passo 2, caso o exemplar esteja indisponível, o sistema informa a indisponibilidade e encerra a operação."
            },
            {
                "code": "FA02",
                "title": "Usuário com pendência",
                "description": "No passo 4, caso o usuário possua pendência ativa, o sistema informa que o empréstimo não pode ser realizado e encerra a operação."
            },
            {
                "code": "FA03",
                "title": "Limite de empréstimos atingido",
                "description": "No passo 5, caso o usuário tenha atingido o limite permitido, o sistema informa o motivo e não realiza o empréstimo."
            }
        ],
        "business_rules": [
            {
                "code": "RN01",
                "description": "Um usuário pode possuir no máximo 5 empréstimos ativos simultaneamente."
            },
            {
                "code": "RN02",
                "description": "Usuários com empréstimos em atraso não podem realizar novos empréstimos."
            },
            {
                "code": "RN03",
                "description": "O prazo padrão de devolução é de 14 dias a partir da data do empréstimo."
            }
        ],
        "postcondition": "O empréstimo é registrado e o exemplar passa a ser considerado indisponível para novos empréstimos."
    }'::JSONB
)
ON CONFLICT (code) DO UPDATE
SET
    title = EXCLUDED.title,
    content = EXCLUDED.content;


-- ============================================================
-- CASO B - RESERVAR EXEMPLAR INDISPONÍVEL
-- ============================================================

INSERT INTO use_cases (
    code,
    title,
    content
)
VALUES (
    'B',
    'Reservar exemplar indisponível',
    '{
        "objective": "Permitir que um usuário realize a reserva de um exemplar indisponível para empréstimo.",
        "main_actor": "Usuário da biblioteca",
        "preconditions": [
            "O usuário deve estar autenticado no sistema.",
            "O usuário deve possuir cadastro ativo na biblioteca."
        ],
        "main_flow": [
            "O usuário consulta um exemplar no sistema.",
            "O sistema apresenta o exemplar e informa sua indisponibilidade.",
            "O usuário solicita a reserva.",
            "O sistema verifica se o usuário já possui uma reserva ativa para o mesmo título.",
            "O sistema verifica se o usuário atingiu o limite máximo de reservas.",
            "O sistema registra a reserva e adiciona o usuário à fila de espera.",
            "O sistema informa a posição do usuário na fila e confirma a operação."
        ],
        "alternative_flows": [
            {
                "code": "FA01",
                "title": "Exemplar disponível",
                "description": "No passo 2, caso exista exemplar disponível, o sistema informa a disponibilidade e não permite a reserva."
            },
            {
                "code": "FA02",
                "title": "Reserva já existente",
                "description": "No passo 4, caso o usuário já possua uma reserva ativa para o mesmo título, o sistema informa que uma nova reserva não pode ser realizada."
            },
            {
                "code": "FA03",
                "title": "Limite de reservas atingido",
                "description": "No passo 5, caso o usuário tenha atingido o limite permitido, o sistema informa o motivo e não registra a reserva."
            }
        ],
        "business_rules": [
            {
                "code": "RN01",
                "description": "Um usuário pode possuir no máximo 3 reservas ativas simultaneamente."
            },
            {
                "code": "RN02",
                "description": "Um usuário não pode possuir mais de uma reserva ativa para o mesmo título."
            },
            {
                "code": "RN03",
                "description": "A reserva somente pode ser realizada quando não houver exemplar disponível para empréstimo."
            }
        ],
        "postcondition": "A reserva é registrada e o usuário passa a integrar a fila de espera do título."
    }'::JSONB
)
ON CONFLICT (code) DO UPDATE
SET
    title = EXCLUDED.title,
    content = EXCLUDED.content;


-- ============================================================
-- CASO C - RENOVAR EMPRÉSTIMO
-- ============================================================

INSERT INTO use_cases (
    code,
    title,
    content
)
VALUES (
    'C',
    'Renovar empréstimo',
    '{
        "objective": "Permitir que um usuário renove o prazo de devolução de um exemplar emprestado.",
        "main_actor": "Usuário da biblioteca",
        "preconditions": [
            "O usuário deve estar autenticado no sistema.",
            "O usuário deve possuir um empréstimo ativo para o exemplar selecionado."
        ],
        "main_flow": [
            "O usuário acessa seus empréstimos ativos.",
            "O sistema apresenta os empréstimos disponíveis para consulta.",
            "O usuário seleciona um empréstimo e solicita a renovação.",
            "O sistema verifica se o empréstimo está dentro do prazo de devolução.",
            "O sistema verifica se existe uma reserva ativa de outro usuário para o título.",
            "O sistema registra a renovação e calcula uma nova data de devolução.",
            "O sistema apresenta a nova data e confirma a operação."
        ],
        "alternative_flows": [
            {
                "code": "FA01",
                "title": "Empréstimo em atraso",
                "description": "No passo 4, caso o prazo de devolução tenha sido ultrapassado, o sistema informa que a renovação não pode ser realizada."
            },
            {
                "code": "FA02",
                "title": "Reserva de outro usuário",
                "description": "No passo 5, caso exista uma reserva ativa de outro usuário para o título, o sistema informa que a renovação não pode ser realizada."
            },
            {
                "code": "FA03",
                "title": "Limite de renovações atingido",
                "description": "No passo 6, caso o empréstimo tenha atingido o limite permitido de renovações, o sistema informa o motivo e encerra a operação."
            }
        ],
        "business_rules": [
            {
                "code": "RN01",
                "description": "Cada empréstimo pode ser renovado no máximo 2 vezes."
            },
            {
                "code": "RN02",
                "description": "Empréstimos em atraso não podem ser renovados."
            },
            {
                "code": "RN03",
                "description": "A renovação não é permitida quando existir uma reserva ativa de outro usuário para o mesmo título."
            }
        ],
        "postcondition": "A renovação é registrada e a data prevista para devolução é atualizada."
    }'::JSONB
)
ON CONFLICT (code) DO UPDATE
SET
    title = EXCLUDED.title,
    content = EXCLUDED.content;


-- ============================================================
-- DISTRIBUIÇÃO DAS ATIVIDADES
-- ============================================================

-- Grupo 1
-- Manual A -> Prompt simples B -> Prompt estruturado C

INSERT INTO group_tasks (group_id, use_case_id, mode, task_order)
VALUES
(
    (SELECT id FROM experiment_groups WHERE name = 'Grupo 1'),
    (SELECT id FROM use_cases WHERE code = 'A'),
    'MANUAL',
    1
),
(
    (SELECT id FROM experiment_groups WHERE name = 'Grupo 1'),
    (SELECT id FROM use_cases WHERE code = 'B'),
    'SIMPLE_PROMPT',
    2
),
(
    (SELECT id FROM experiment_groups WHERE name = 'Grupo 1'),
    (SELECT id FROM use_cases WHERE code = 'C'),
    'STRUCTURED_PROMPT',
    3
);


-- Grupo 2
-- Prompt simples A -> Prompt estruturado B -> Manual C

INSERT INTO group_tasks (group_id, use_case_id, mode, task_order)
VALUES
(
    (SELECT id FROM experiment_groups WHERE name = 'Grupo 2'),
    (SELECT id FROM use_cases WHERE code = 'A'),
    'SIMPLE_PROMPT',
    1
),
(
    (SELECT id FROM experiment_groups WHERE name = 'Grupo 2'),
    (SELECT id FROM use_cases WHERE code = 'B'),
    'STRUCTURED_PROMPT',
    2
),
(
    (SELECT id FROM experiment_groups WHERE name = 'Grupo 2'),
    (SELECT id FROM use_cases WHERE code = 'C'),
    'MANUAL',
    3
);


-- Grupo 3
-- Prompt estruturado A -> Manual B -> Prompt simples C

INSERT INTO group_tasks (group_id, use_case_id, mode, task_order)
VALUES
(
    (SELECT id FROM experiment_groups WHERE name = 'Grupo 3'),
    (SELECT id FROM use_cases WHERE code = 'A'),
    'STRUCTURED_PROMPT',
    1
),
(
    (SELECT id FROM experiment_groups WHERE name = 'Grupo 3'),
    (SELECT id FROM use_cases WHERE code = 'B'),
    'MANUAL',
    2
),
(
    (SELECT id FROM experiment_groups WHERE name = 'Grupo 3'),
    (SELECT id FROM use_cases WHERE code = 'C'),
    'SIMPLE_PROMPT',
    3
);


COMMIT;