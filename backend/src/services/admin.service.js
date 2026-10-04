import pool from "../config/database.js";

const VALID_MODES = ["MANUAL", "SIMPLE_PROMPT", "STRUCTURED_PROMPT"];
const VALID_STATUSES = ["PENDING", "IN_PROGRESS", "COMPLETED"];
const CSV_SEPARATOR = ";";
const APP_HIGHLIGHT_COLOR = "0F766E";
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
  ["participant_input", "Entrada do participante"],
  ["final_prompt", "Prompt final enviado"],
  ["ai_started_at", "Inicio da IA"],
  ["ai_finished_at", "Fim da IA"],
  ["response_time_ms", "Tempo de resposta da IA"],
  ["raw_response", "Resposta da IA"],
  ["test_cases", "Casos de teste manuais"],
];
const EXCEL_COLUMN_WIDTHS = {
  participant_id: 14,
  participant_code: 18,
  group_id: 12,
  group_name: 16,
  course_period: 18,
  software_dev_experience: 28,
  software_testing_experience: 24,
  test_case_experience: 28,
  requirements_familiarity: 28,
  genai_usage_frequency: 28,
  genai_software_usage: 28,
  genai_test_case_usage: 30,
  experiment_task_id: 14,
  task_order: 14,
  mode: 24,
  status: 16,
  use_case_id: 14,
  use_case_code: 16,
  use_case_title: 34,
  started_at: 20,
  finished_at: 20,
  duration_seconds: 14,
  model: 24,
  prompt_version: 16,
  participant_input: 42,
  final_prompt: 52,
  ai_started_at: 20,
  ai_finished_at: 20,
  response_time_ms: 20,
  raw_response: 56,
  test_cases: 48,
};
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

function formatCsvValue(value) {
  if (value === null || value === undefined) {
    return "";
  }

  const stringValue =
    value instanceof Date
      ? value.toISOString()
      : typeof value === "object"
        ? JSON.stringify(value)
        : String(value);

  if (
    stringValue.includes('"') ||
    stringValue.includes(CSV_SEPARATOR) ||
    /[\r\n]/.test(stringValue)
  ) {
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

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
}

function formatXlsxValue(value) {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "object") {
    return JSON.stringify(value, null, 2);
  }

  return String(value);
}

function getColumnLetter(columnNumber) {
  let remaining = columnNumber;
  let letters = "";

  while (remaining > 0) {
    const modulo = (remaining - 1) % 26;

    letters = String.fromCharCode(65 + modulo) + letters;
    remaining = Math.floor((remaining - modulo) / 26);
  }

  return letters;
}

function createCellXml(rowNumber, columnNumber, value, styleId = 0) {
  const cellReference = `${getColumnLetter(columnNumber)}${rowNumber}`;
  const formattedValue = escapeXml(formatXlsxValue(value));

  return `<c r="${cellReference}" t="inlineStr" s="${styleId}"><is><t xml:space="preserve">${formattedValue}</t></is></c>`;
}

function buildWorksheetXml(rows) {
  const totalRows = rows.length + 1;
  const totalColumns = EXPORT_COLUMNS.length;
  const lastCellReference = `${getColumnLetter(totalColumns)}${totalRows}`;
  const columnsXml = EXPORT_COLUMNS.map(([key], index) => {
    const columnNumber = index + 1;
    const width = EXCEL_COLUMN_WIDTHS[key] || 18;

    return `<col min="${columnNumber}" max="${columnNumber}" width="${width}" customWidth="1"/>`;
  }).join("");
  const headerCells = EXPORT_COLUMNS.map(([, label], index) =>
    createCellXml(1, index + 1, label, 1),
  ).join("");
  const dataRows = rows.map((row, rowIndex) => {
    const rowNumber = rowIndex + 2;
    const cells = EXPORT_COLUMNS.map(([key], columnIndex) =>
      createCellXml(rowNumber, columnIndex + 1, row[key]),
    ).join("");

    return `<row r="${rowNumber}" ht="24" customHeight="1">${cells}</row>`;
  }).join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <dimension ref="A1:${lastCellReference}"/>
  <sheetViews>
    <sheetView workbookViewId="0">
      <pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>
      <selection pane="bottomLeft" activeCell="A2" sqref="A2"/>
    </sheetView>
  </sheetViews>
  <cols>${columnsXml}</cols>
  <sheetData>
    <row r="1" ht="28" customHeight="1">${headerCells}</row>
    ${dataRows}
  </sheetData>
  <autoFilter ref="A1:${getColumnLetter(totalColumns)}1"/>
</worksheet>`;
}

function buildStylesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="2">
    <font><sz val="11"/><color theme="1"/><name val="Arial"/></font>
    <font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Arial"/></font>
  </fonts>
  <fills count="3">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF${APP_HIGHLIGHT_COLOR}"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border>
      <left style="thin"><color rgb="FFD1D5DB"/></left>
      <right style="thin"><color rgb="FFD1D5DB"/></right>
      <top style="thin"><color rgb="FFD1D5DB"/></top>
      <bottom style="thin"><color rgb="FFD1D5DB"/></bottom>
      <diagonal/>
    </border>
  </borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="2">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
  </cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;
}

const CRC32_TABLE = Array.from({ length: 256 }, (_, index) => {
  let crc = index;

  for (let bit = 0; bit < 8; bit += 1) {
    crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }

  return crc >>> 0;
});

function getCrc32(buffer) {
  let crc = 0xffffffff;

  for (const byte of buffer) {
    crc = CRC32_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function createZip(files) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  files.forEach(({ name, content }) => {
    const nameBuffer = Buffer.from(name);
    const contentBuffer = Buffer.from(content);
    const crc32 = getCrc32(contentBuffer);
    const localHeader = Buffer.alloc(30);

    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0, 12);
    localHeader.writeUInt32LE(crc32, 14);
    localHeader.writeUInt32LE(contentBuffer.length, 18);
    localHeader.writeUInt32LE(contentBuffer.length, 22);
    localHeader.writeUInt16LE(nameBuffer.length, 26);
    localHeader.writeUInt16LE(0, 28);
    localParts.push(localHeader, nameBuffer, contentBuffer);

    const centralHeader = Buffer.alloc(46);

    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0, 14);
    centralHeader.writeUInt32LE(crc32, 16);
    centralHeader.writeUInt32LE(contentBuffer.length, 20);
    centralHeader.writeUInt32LE(contentBuffer.length, 24);
    centralHeader.writeUInt16LE(nameBuffer.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);
    centralParts.push(centralHeader, nameBuffer);

    offset += localHeader.length + nameBuffer.length + contentBuffer.length;
  });

  const centralDirectory = Buffer.concat(centralParts);
  const centralDirectoryOffset = offset;
  const endRecord = Buffer.alloc(22);

  endRecord.writeUInt32LE(0x06054b50, 0);
  endRecord.writeUInt16LE(0, 4);
  endRecord.writeUInt16LE(0, 6);
  endRecord.writeUInt16LE(files.length, 8);
  endRecord.writeUInt16LE(files.length, 10);
  endRecord.writeUInt32LE(centralDirectory.length, 12);
  endRecord.writeUInt32LE(centralDirectoryOffset, 16);
  endRecord.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralDirectory, endRecord]);
}

function toXlsx(rows) {
  const files = [
    {
      name: "[Content_Types].xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`,
    },
    {
      name: "_rels/.rels",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`,
    },
    {
      name: "xl/workbook.xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets><sheet name="Resultados" sheetId="1" r:id="rId1"/></sheets>
</workbook>`,
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`,
    },
    {
      name: "xl/styles.xml",
      content: buildStylesXml(),
    },
    {
      name: "xl/worksheets/sheet1.xml",
      content: buildWorksheetXml(rows),
    },
  ];

  return createZip(files);
}

export async function findParticipantsProgress() {
  const query = `
    SELECT
      participants.id,
      participants.code,
      experiment_groups.id AS group_id,
      experiment_groups.name AS group_name,
      participants.consent_confirmed,
      participant_access.email,
      participant_access.access_code_created_at,
      participant_access.last_sent_at,
      participant_access.failed_attempts,
      participant_access.locked_until,
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
    LEFT JOIN participant_access
      ON participant_access.participant_id = participants.id
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
      participant_access.email,
      participant_access.access_code_created_at,
      participant_access.last_sent_at,
      participant_access.failed_attempts,
      participant_access.locked_until,
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
    access: row.email
      ? {
          email: row.email,
          access_code_created_at: row.access_code_created_at,
          last_sent_at: row.last_sent_at,
          failed_attempts: row.failed_attempts,
          locked_until: row.locked_until,
        }
      : null,
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
      ai_runs.participant_input,
      ai_runs.final_prompt,
      ai_runs.response_time_ms,
      ai_runs.raw_response
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
      ai_runs.participant_input,
      ai_runs.final_prompt,
      ai_runs.response_time_ms,
      ai_runs.raw_response
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
            participant_input: task.participant_input,
            final_prompt: task.final_prompt,
            raw_response: task.raw_response,
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
      ai_runs.participant_input,
      ai_runs.final_prompt,
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
            participant_input: row.participant_input,
            final_prompt: row.final_prompt,
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
    participant_input: item.ai?.participant_input,
    final_prompt: item.ai?.final_prompt,
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

export async function exportExperimentDataAsXlsx() {
  const rows = await getFormattedExperimentExportRows();

  return toXlsx(rows);
}
