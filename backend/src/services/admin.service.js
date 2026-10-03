import pool from "../config/database.js";

const VALID_MODES = ["MANUAL", "SIMPLE_PROMPT", "STRUCTURED_PROMPT"];
const VALID_STATUSES = ["PENDING", "IN_PROGRESS", "COMPLETED"];
const CSV_SEPARATOR = ";";
const APP_HIGHLIGHT_COLOR = "#0f766e";
const EXPORT_COLUMNS = [
  ["participant_id", "ID do participante"],
  ["participant_code", "Codigo do participante"],
  ["group_id", "ID do grupo"],
  ["group_name", "Grupo"],
  ["course_period", "Periodo do curso"],
  ["software_dev_experience", "Experiencia em desenvolvimento"],
  ["software_testing_experience", "Experiencia em testes"],
  ["test_case_experience", "Experiencia com casos de teste"],
  ["requirements_familiarity", "Familiaridade com requisitos"],
  ["genai_usage_frequency", "Frequencia de uso de IA generativa"],
  ["genai_software_usage", "Uso de IA em desenvolvimento"],
  ["genai_test_case_usage", "Uso de IA para casos de teste"],
  ["experiment_task_id", "ID da atividade"],
  ["task_order", "Ordem da atividade"],
  ["mode", "Modo"],
  ["status", "Status"],
  ["use_case_id", "ID do caso de uso"],
  ["use_case_code", "Codigo do caso de uso"],
  ["use_case_title", "Titulo do caso de uso"],
  ["started_at", "Inicio"],
  ["finished_at", "Fim"],
  ["duration_seconds", "Duracao"],
  ["model", "Modelo da IA"],
  ["prompt_version", "Versao do prompt"],
  ["ai_started_at", "Inicio da IA"],
  ["ai_finished_at", "Fim da IA"],
  ["response_time_ms", "Tempo de resposta da IA"],
  ["raw_response", "Resposta da IA"],
  ["test_cases", "Casos de teste manuais"],
];
const MODE_LABELS = {
  MANUAL: "Manual",
  SIMPLE_PROMPT: "IA com prompt simples",
  STRUCTURED_PROMPT: "IA com prompt estruturado",
};
const STATUS_LABELS = {
  PENDING: "Pendente",
  IN_PROGRESS: "Em andamento",
  COMPLETED: "Concluida",
};

function createBadRequestError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function formatDateTime(value) {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "medium",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

function formatDuration(seconds) {
  if (seconds === null || seconds === undefined) {
    return "";
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes === 0) {
    return `${seconds} s`;
  }

  return `${minutes} min ${remainingSeconds} s`;
}

function formatResponseTime(milliseconds) {
  if (milliseconds === null || milliseconds === undefined) {
    return "";
  }

  return `${milliseconds} ms`;
}

function formatTestCases(testCases) {
  if (!Array.isArray(testCases) || testCases.length === 0) {
    return "";
  }

  return testCases
    .map((testCase) =>
      [
        `Caso ${testCase.sequence_number}: ${testCase.title}`,
        `Pre-condicoes: ${(testCase.preconditions || []).join(" | ")}`,
        `Passos: ${(testCase.steps || []).join(" | ")}`,
        `Resultado esperado: ${testCase.expected_result}`,
      ].join("\n"),
    )
    .join("\n\n");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function formatCsvValue(value) {
  if (value === null || value === undefined) {
    return "";
  }

  const stringValue = (
    value instanceof Date
      ? value.toISOString()
      : typeof value === "object"
        ? JSON.stringify(value)
        : String(value)
  ).replace(/\r\n|\r|\n/g, "\\n");

  if (stringValue.includes('"') || stringValue.includes(CSV_SEPARATOR)) {
    return `"${stringValue.replaceAll('"', '""')}"`;
  }

  return stringValue;
}

function toCsv(rows) {
  const header = EXPORT_COLUMNS.map(([, label]) => label).join(CSV_SEPARATOR);
  const body = rows.map((row) =>
    EXPORT_COLUMNS.map(([column]) => formatCsvValue(row[column])).join(
      CSV_SEPARATOR,
    ),
  );

  return `\uFEFFsep=${CSV_SEPARATOR}\r\n${[header, ...body].join("\r\n")}`;
}

function toExcelHtml(rows) {
  const header = EXPORT_COLUMNS.map(
    ([, label]) => `<th>${escapeHtml(label)}</th>`,
  ).join("");
  const body = rows
    .map((row) => {
      const cells = EXPORT_COLUMNS.map(([column]) => {
        const value = row[column] ?? "";
        const htmlValue = escapeHtml(value)
          .replace(/\r\n|\r|\n/g, "<br>")
          .replaceAll("\\n", "<br>");

        return `<td>${htmlValue}</td>`;
      }).join("");

      return `<tr>${cells}</tr>`;
    })
    .join("");

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      body { font-family: Arial, sans-serif; }
      table { border-collapse: collapse; width: 100%; }
      th {
        background: ${APP_HIGHLIGHT_COLOR};
        color: #ffffff;
        font-weight: 700;
        text-align: left;
      }
      th, td {
        border: 1px solid #d1d5db;
        padding: 8px;
        vertical-align: top;
        white-space: normal;
      }
      tr:nth-child(even) td { background: #f8fafc; }
    </style>
  </head>
  <body>
    <table>
      <thead><tr>${header}</tr></thead>
      <tbody>${body}</tbody>
    </table>
  </body>
</html>`;
}

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

export async function findExperimentTasks(filters = {}) {
  const where = [];
  const values = [];

  if (filters.mode) {
    if (!VALID_MODES.includes(filters.mode)) {
      throw createBadRequestError("Modo invalido.");
    }

    values.push(filters.mode);
    where.push(`experiment_tasks.mode = $${values.length}`);
  }

  if (filters.status) {
    if (!VALID_STATUSES.includes(filters.status)) {
      throw createBadRequestError("Status invalido.");
    }

    values.push(filters.status);
    where.push(`experiment_tasks.status = $${values.length}`);
  }

  if (filters.participant_id) {
    values.push(filters.participant_id);
    where.push(`experiment_tasks.participant_id = $${values.length}`);
  }

  if (filters.group_id) {
    values.push(filters.group_id);
    where.push(`participants.group_id = $${values.length}`);
  }

  if (filters.use_case_id) {
    values.push(filters.use_case_id);
    where.push(`experiment_tasks.use_case_id = $${values.length}`);
  }

  const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

  const query = `
    SELECT
      experiment_tasks.id AS task_id,
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
      participants.id AS participant_id,
      participants.code AS participant_code,
      experiment_groups.id AS group_id,
      experiment_groups.name AS group_name,
      use_cases.id AS use_case_id,
      use_cases.code AS use_case_code,
      use_cases.title AS use_case_title,
      ai_runs.model,
      prompt_versions.version AS prompt_version,
      ai_runs.response_time_ms
    FROM experiment_tasks
    INNER JOIN participants
      ON participants.id = experiment_tasks.participant_id
    INNER JOIN experiment_groups
      ON experiment_groups.id = participants.group_id
    INNER JOIN use_cases
      ON use_cases.id = experiment_tasks.use_case_id
    LEFT JOIN ai_runs
      ON ai_runs.experiment_task_id = experiment_tasks.id
    LEFT JOIN prompt_versions
      ON prompt_versions.id = ai_runs.prompt_version_id
    ${whereSql}
    ORDER BY participants.code, experiment_tasks.task_order
  `;

  const { rows } = await pool.query(query, values);

  return rows.map((row) => ({
    task_id: row.task_id,
    participant: {
      id: row.participant_id,
      code: row.participant_code,
    },
    group: {
      id: row.group_id,
      name: row.group_name,
    },
    task_order: row.task_order,
    mode: row.mode,
    status: row.status,
    started_at: row.started_at,
    finished_at: row.finished_at,
    duration_seconds: row.duration_seconds,
    use_case: {
      id: row.use_case_id,
      code: row.use_case_code,
      title: row.use_case_title,
    },
    ai:
      row.mode === "SIMPLE_PROMPT" || row.mode === "STRUCTURED_PROMPT"
        ? {
            model: row.model,
            prompt_version: row.prompt_version,
            response_time_ms: row.response_time_ms,
          }
        : null,
  }));
}

export async function getExperimentSummary() {
  const participantsQuery = `
    SELECT
      COUNT(participants.id)::int AS total,
      COUNT(completed_participants.participant_id)::int AS with_completed_experiment
    FROM participants
    LEFT JOIN (
      SELECT participant_id
      FROM experiment_tasks
      GROUP BY participant_id
      HAVING COUNT(id) = 3
        AND COUNT(id) FILTER (WHERE status = 'COMPLETED') = 3
    ) completed_participants
      ON completed_participants.participant_id = participants.id
  `;

  const tasksQuery = `
    SELECT
      COUNT(id)::int AS total,
      COUNT(id) FILTER (WHERE status = 'PENDING')::int AS pending,
      COUNT(id) FILTER (WHERE status = 'IN_PROGRESS')::int AS in_progress,
      COUNT(id) FILTER (WHERE status = 'COMPLETED')::int AS completed
    FROM experiment_tasks
  `;

  const modesQuery = `
    SELECT
      mode,
      COUNT(id)::int AS total,
      COUNT(id) FILTER (WHERE status = 'COMPLETED')::int AS completed
    FROM experiment_tasks
    GROUP BY mode
  `;

  const [participantsResult, tasksResult, modesResult] = await Promise.all([
    pool.query(participantsQuery),
    pool.query(tasksQuery),
    pool.query(modesQuery),
  ]);

  const byMode = VALID_MODES.reduce((summary, mode) => {
    summary[mode] = {
      total: 0,
      completed: 0,
    };

    return summary;
  }, {});

  modesResult.rows.forEach((row) => {
    byMode[row.mode] = {
      total: row.total,
      completed: row.completed,
    };
  });

  const participants = participantsResult.rows[0];
  const tasks = tasksResult.rows[0];

  return {
    participants: {
      total: participants.total,
      with_completed_experiment: participants.with_completed_experiment,
    },
    tasks: {
      total: tasks.total,
      pending: tasks.pending,
      in_progress: tasks.in_progress,
      completed: tasks.completed,
    },
    by_mode: byMode,
  };
}

export async function exportExperimentDataAsJson() {
  const tasksQuery = `
    SELECT
      experiment_tasks.id AS task_id,
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
      participants.id AS participant_id,
      participants.code AS participant_code,
      participants.consent_confirmed,
      participants.created_at AS participant_created_at,
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
      participant_profiles.created_at AS profile_created_at,
      use_cases.id AS use_case_id,
      use_cases.code AS use_case_code,
      use_cases.title AS use_case_title,
      ai_runs.model,
      prompt_versions.version AS prompt_version,
      ai_runs.started_at AS ai_started_at,
      ai_runs.finished_at AS ai_finished_at,
      ai_runs.response_time_ms,
      ai_runs.raw_response
    FROM experiment_tasks
    INNER JOIN participants
      ON participants.id = experiment_tasks.participant_id
    INNER JOIN experiment_groups
      ON experiment_groups.id = participants.group_id
    LEFT JOIN participant_profiles
      ON participant_profiles.participant_id = participants.id
    INNER JOIN use_cases
      ON use_cases.id = experiment_tasks.use_case_id
    LEFT JOIN ai_runs
      ON ai_runs.experiment_task_id = experiment_tasks.id
    LEFT JOIN prompt_versions
      ON prompt_versions.id = ai_runs.prompt_version_id
    ORDER BY participants.code, experiment_tasks.task_order
  `;

  const tasksResult = await pool.query(tasksQuery);
  const taskIds = tasksResult.rows.map((task) => task.task_id);

  if (taskIds.length === 0) {
    return [];
  }

  const testCasesQuery = `
    SELECT
      id,
      experiment_task_id,
      sequence_number,
      title,
      preconditions,
      steps,
      expected_result,
      created_at,
      updated_at
    FROM test_cases
    WHERE experiment_task_id = ANY($1::bigint[])
    ORDER BY experiment_task_id, sequence_number
  `;

  const testCasesResult = await pool.query(testCasesQuery, [taskIds]);
  const testCasesByTask = testCasesResult.rows.reduce((groups, testCase) => {
    const taskCases = groups.get(testCase.experiment_task_id) || [];

    taskCases.push({
      id: testCase.id,
      sequence_number: testCase.sequence_number,
      title: testCase.title,
      preconditions: testCase.preconditions,
      steps: testCase.steps,
      expected_result: testCase.expected_result,
      created_at: testCase.created_at,
      updated_at: testCase.updated_at,
    });

    groups.set(testCase.experiment_task_id, taskCases);

    return groups;
  }, new Map());

  return tasksResult.rows.map((row) => ({
    participant: {
      id: row.participant_id,
      code: row.participant_code,
      consent_confirmed: row.consent_confirmed,
      created_at: row.participant_created_at,
    },
    group: {
      id: row.group_id,
      name: row.group_name,
    },
    profile: row.profile_created_at
      ? {
          course_period: row.course_period,
          software_dev_experience: row.software_dev_experience,
          software_testing_experience: row.software_testing_experience,
          test_case_experience: row.test_case_experience,
          requirements_familiarity: row.requirements_familiarity,
          genai_usage_frequency: row.genai_usage_frequency,
          genai_software_usage: row.genai_software_usage,
          genai_test_case_usage: row.genai_test_case_usage,
          created_at: row.profile_created_at,
        }
      : null,
    activity: {
      id: row.task_id,
      task_order: row.task_order,
      mode: row.mode,
      status: row.status,
      started_at: row.started_at,
      finished_at: row.finished_at,
      duration_seconds: row.duration_seconds,
    },
    use_case: {
      id: row.use_case_id,
      code: row.use_case_code,
      title: row.use_case_title,
    },
    ai:
      row.mode === "SIMPLE_PROMPT" || row.mode === "STRUCTURED_PROMPT"
        ? {
            model: row.model,
            prompt_version: row.prompt_version,
            ai_started_at: row.ai_started_at,
            ai_finished_at: row.ai_finished_at,
            response_time_ms: row.response_time_ms,
            raw_response: row.raw_response,
          }
        : null,
    test_cases: testCasesByTask.get(row.task_id) || [],
  }));
}

async function getFormattedExperimentExportRows() {
  const data = await exportExperimentDataAsJson();

  return data.map((item) => ({
    participant_id: item.participant.id,
    participant_code: item.participant.code,
    group_id: item.group.id,
    group_name: item.group.name,
    course_period: item.profile?.course_period,
    software_dev_experience: item.profile?.software_dev_experience,
    software_testing_experience: item.profile?.software_testing_experience,
    test_case_experience: item.profile?.test_case_experience,
    requirements_familiarity: item.profile?.requirements_familiarity,
    genai_usage_frequency: item.profile?.genai_usage_frequency,
    genai_software_usage: item.profile?.genai_software_usage,
    genai_test_case_usage: item.profile?.genai_test_case_usage,
    experiment_task_id: item.activity.id,
    task_order: item.activity.task_order,
    mode: MODE_LABELS[item.activity.mode] || item.activity.mode,
    status: STATUS_LABELS[item.activity.status] || item.activity.status,
    use_case_id: item.use_case.id,
    use_case_code: item.use_case.code,
    use_case_title: item.use_case.title,
    started_at: formatDateTime(item.activity.started_at),
    finished_at: formatDateTime(item.activity.finished_at),
    duration_seconds: formatDuration(item.activity.duration_seconds),
    model: item.ai?.model,
    prompt_version: item.ai?.prompt_version,
    ai_started_at: formatDateTime(item.ai?.ai_started_at),
    ai_finished_at: formatDateTime(item.ai?.ai_finished_at),
    response_time_ms: formatResponseTime(item.ai?.response_time_ms),
    raw_response: item.ai?.raw_response,
    test_cases: formatTestCases(item.test_cases),
  }));
}

export async function exportExperimentDataAsCsv() {
  const rows = await getFormattedExperimentExportRows();

  return toCsv(rows);
}

export async function exportExperimentDataAsXls() {
  const rows = await getFormattedExperimentExportRows();

  return toExcelHtml(rows);
}
