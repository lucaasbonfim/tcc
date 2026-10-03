import pool from "../config/database.js";

export async function findParticipantsProgress() {
  const query = `
    SELECT
      participants.id,
      participants.code,
      experiment_groups.id AS group_id,
      experiment_groups.name AS group_name,
      participants.consent_confirmed,
      (participant_profiles.id IS NOT NULL) AS profile_completed,
      COUNT(experiment_tasks.id)::int AS tasks_total,
      COUNT(experiment_tasks.id) FILTER (
        WHERE experiment_tasks.status = 'PENDING'
      )::int AS tasks_pending,
      COUNT(experiment_tasks.id) FILTER (
        WHERE experiment_tasks.status = 'IN_PROGRESS'
      )::int AS tasks_in_progress,
      COUNT(experiment_tasks.id) FILTER (
        WHERE experiment_tasks.status = 'COMPLETED'
      )::int AS tasks_completed
    FROM participants
    INNER JOIN experiment_groups
      ON experiment_groups.id = participants.group_id
    LEFT JOIN participant_profiles
      ON participant_profiles.participant_id = participants.id
    LEFT JOIN experiment_tasks
      ON experiment_tasks.participant_id = participants.id
    GROUP BY
      participants.id,
      participants.code,
      experiment_groups.id,
      experiment_groups.name,
      participants.consent_confirmed,
      participant_profiles.id
    ORDER BY participants.code
  `;

  const { rows } = await pool.query(query);

  return rows.map((row) => ({
    id: row.id,
    code: row.code,
    group: {
      id: row.group_id,
      name: row.group_name,
    },
    consent_confirmed: row.consent_confirmed,
    profile_completed: row.profile_completed,
    tasks: {
      total: row.tasks_total,
      pending: row.tasks_pending,
      in_progress: row.tasks_in_progress,
      completed: row.tasks_completed,
    },
  }));
}

export async function findParticipantDetailsById(participantId) {
  const participantQuery = `
    SELECT
      participants.id,
      participants.code,
      participants.consent_confirmed,
      participants.created_at,
      experiment_groups.id AS group_id,
      experiment_groups.name AS group_name,
      participant_profiles.course_period,
      participant_profiles.software_dev_experience,
      participant_profiles.software_testing_experience,
      participant_profiles.test_case_experience,
      participant_profiles.requirements_familiarity,
      participant_profiles.genai_usage_frequency,
      participant_profiles.genai_software_usage,
      participant_profiles.genai_test_case_usage,
      participant_profiles.created_at AS profile_created_at
    FROM participants
    INNER JOIN experiment_groups
      ON experiment_groups.id = participants.group_id
    LEFT JOIN participant_profiles
      ON participant_profiles.participant_id = participants.id
    WHERE participants.id = $1
  `;
  const participantResult = await pool.query(participantQuery, [participantId]);
  const participant = participantResult.rows[0];

  if (!participant) {
    const error = new Error("Participante não encontrado.");
    error.statusCode = 404;
    throw error;
  }

  const tasksQuery = `
    SELECT
      experiment_tasks.id,
      experiment_tasks.task_order,
      experiment_tasks.mode,
      experiment_tasks.status,
      experiment_tasks.started_at,
      experiment_tasks.finished_at,
      CASE
        WHEN experiment_tasks.started_at IS NOT NULL
          AND experiment_tasks.finished_at IS NOT NULL
        THEN EXTRACT(
          EPOCH FROM (experiment_tasks.finished_at - experiment_tasks.started_at)
        )::int
        ELSE NULL
      END AS duration_seconds,
      use_cases.id AS use_case_id,
      use_cases.code AS use_case_code,
      use_cases.title AS use_case_title,
      COUNT(test_cases.id)::int AS test_cases_count,
      ai_runs.model,
      prompt_versions.version AS prompt_version,
      ai_runs.response_time_ms
    FROM experiment_tasks
    INNER JOIN use_cases
      ON use_cases.id = experiment_tasks.use_case_id
    LEFT JOIN test_cases
      ON test_cases.experiment_task_id = experiment_tasks.id
    LEFT JOIN ai_runs
      ON ai_runs.experiment_task_id = experiment_tasks.id
    LEFT JOIN prompt_versions
      ON prompt_versions.id = ai_runs.prompt_version_id
    WHERE experiment_tasks.participant_id = $1
    GROUP BY
      experiment_tasks.id,
      use_cases.id,
      use_cases.code,
      use_cases.title,
      ai_runs.model,
      prompt_versions.version,
      ai_runs.response_time_ms
    ORDER BY experiment_tasks.task_order
  `;
  const tasksResult = await pool.query(tasksQuery, [participantId]);

  return {
    participant: {
      id: participant.id,
      code: participant.code,
      consent_confirmed: participant.consent_confirmed,
      created_at: participant.created_at,
    },
    group: {
      id: participant.group_id,
      name: participant.group_name,
    },
    profile: participant.profile_created_at
      ? {
          course_period: participant.course_period,
          software_dev_experience: participant.software_dev_experience,
          software_testing_experience: participant.software_testing_experience,
          test_case_experience: participant.test_case_experience,
          requirements_familiarity: participant.requirements_familiarity,
          genai_usage_frequency: participant.genai_usage_frequency,
          genai_software_usage: participant.genai_software_usage,
          genai_test_case_usage: participant.genai_test_case_usage,
          created_at: participant.profile_created_at,
        }
      : null,
    activities: tasksResult.rows.map((task) => ({
      id: task.id,
      task_order: task.task_order,
      mode: task.mode,
      status: task.status,
      started_at: task.started_at,
      finished_at: task.finished_at,
      duration_seconds: task.duration_seconds,
      use_case: {
        id: task.use_case_id,
        code: task.use_case_code,
        title: task.use_case_title,
      },
      manual:
        task.mode === "MANUAL"
          ? {
              test_cases_count: task.test_cases_count,
            }
          : null,
      ai:
        task.mode === "SIMPLE_PROMPT" || task.mode === "STRUCTURED_PROMPT"
          ? {
              model: task.model,
              prompt_version: task.prompt_version,
              response_time_ms: task.response_time_ms,
            }
          : null,
    })),
  };
}
