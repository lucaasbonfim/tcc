import bcrypt from "bcryptjs";
import crypto from "crypto";
import pool from "../config/database.js";
import { sendParticipantAccessEmail } from "./email.service.js";

const ACCESS_CODE_LENGTH = 8;
const ACCESS_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const ACCESS_CODE_SALT_ROUNDS = 12;
const GROUP_ASSIGNMENT_LOCK_ID = 2026100301;
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 15;
const INVALID_ACCESS_MESSAGE = "E-mail ou codigo de acesso invalido.";

function createServiceError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

export function normalizeEmail(email) {
  return email?.trim().toLowerCase() || "";
}

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function generateAccessCode() {
  let code = "";

  for (let index = 0; index < ACCESS_CODE_LENGTH; index += 1) {
    const randomIndex = crypto.randomInt(0, ACCESS_CODE_ALPHABET.length);

    code += ACCESS_CODE_ALPHABET[randomIndex];
  }

  return code;
}

async function hashAccessCode(accessCode) {
  return bcrypt.hash(accessCode, ACCESS_CODE_SALT_ROUNDS);
}

function createInvalidAccessError() {
  return createServiceError(401, INVALID_ACCESS_MESSAGE);
}

async function markAccessEmailSent(participantId) {
  await pool.query(
    `
      UPDATE participant_access
      SET last_sent_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE participant_id = $1
    `,
    [participantId],
  );
}

async function sendAccessEmailAfterCommit({ participantId, email, accessCode }) {
  try {
    await sendParticipantAccessEmail({ email, accessCode });
    await markAccessEmailSent(participantId);

    return true;
  } catch (error) {
    console.error("Falha ao enviar e-mail de acesso:", error.message);
    return false;
  }
}

export async function createParticipantAccess({ email }) {
  const normalizedEmail = normalizeEmail(email);

  if (!isValidEmail(normalizedEmail)) {
    throw createServiceError(400, "E-mail invalido.");
  }

  const accessCode = generateAccessCode();
  const accessCodeHash = await hashAccessCode(accessCode);
  const client = await pool.connect();
  let createdParticipant;
  let selectedGroup;

  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock($1)", [
      GROUP_ASSIGNMENT_LOCK_ID,
    ]);

    const existingAccessResult = await client.query(
      `
        SELECT id
        FROM participant_access
        WHERE LOWER(email) = LOWER($1)
      `,
      [normalizedEmail],
    );

    if (existingAccessResult.rows[0]) {
      throw createServiceError(409, "Ja existe participante com este e-mail.");
    }

    const codeResult = await client.query(
      "SELECT nextval('participant_code_seq')::int AS next_code",
    );
    const participantCode = `P${String(codeResult.rows[0].next_code).padStart(
      2,
      "0",
    )}`;

    const groupResult = await client.query(
      `
        SELECT experiment_groups.id, experiment_groups.name, COUNT(participants.id)::int AS total
        FROM experiment_groups
        LEFT JOIN participants
          ON participants.group_id = experiment_groups.id
        WHERE experiment_groups.name IN ('Grupo 1', 'Grupo 2', 'Grupo 3')
        GROUP BY experiment_groups.id, experiment_groups.name
        ORDER BY total ASC, RANDOM()
        LIMIT 1
      `,
    );
    selectedGroup = groupResult.rows[0];

    if (!selectedGroup) {
      throw createServiceError(400, "Nenhum grupo experimental configurado.");
    }

    const participantResult = await client.query(
      `
        INSERT INTO participants (code, group_id, consent_confirmed)
        VALUES ($1, $2, FALSE)
        RETURNING id, code, group_id, consent_confirmed, created_at
      `,
      [participantCode, selectedGroup.id],
    );
    createdParticipant = participantResult.rows[0];

    await client.query(
      `
        INSERT INTO participant_access (
          participant_id,
          email,
          access_code_hash,
          access_code_created_at
        )
        VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
      `,
      [createdParticipant.id, normalizedEmail, accessCodeHash],
    );

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");

    if (error.code === "23505") {
      throw createServiceError(409, "Ja existe participante com este e-mail.");
    }

    throw error;
  } finally {
    client.release();
  }

  const emailSent = await sendAccessEmailAfterCommit({
    participantId: createdParticipant.id,
    email: normalizedEmail,
    accessCode,
  });

  return {
    id: createdParticipant.id,
    code: createdParticipant.code,
    email: normalizedEmail,
    group: {
      id: selectedGroup.id,
      name: selectedGroup.name,
    },
    email_sent: emailSent,
  };
}

export async function resendParticipantAccess(participantId) {
  const accessCode = generateAccessCode();
  const accessCodeHash = await hashAccessCode(accessCode);
  const client = await pool.connect();
  let participantAccess;

  try {
    await client.query("BEGIN");

    const accessResult = await client.query(
      `
        SELECT
          participants.id,
          participants.code,
          participant_access.email
        FROM participants
        INNER JOIN participant_access
          ON participant_access.participant_id = participants.id
        WHERE participants.id = $1
        FOR UPDATE OF participant_access
      `,
      [participantId],
    );
    participantAccess = accessResult.rows[0];

    if (!participantAccess) {
      throw createServiceError(404, "Acesso do participante nao encontrado.");
    }

    await client.query(
      `
        UPDATE participant_access
        SET access_code_hash = $1,
            access_code_created_at = CURRENT_TIMESTAMP,
            last_sent_at = NULL,
            failed_attempts = 0,
            locked_until = NULL,
            updated_at = CURRENT_TIMESTAMP
        WHERE participant_id = $2
      `,
      [accessCodeHash, participantId],
    );

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  const emailSent = await sendAccessEmailAfterCommit({
    participantId: participantAccess.id,
    email: participantAccess.email,
    accessCode,
  });

  return {
    id: participantAccess.id,
    code: participantAccess.code,
    email: participantAccess.email,
    email_sent: emailSent,
  };
}

export async function authenticateParticipantAccess({ email, access_code }) {
  const normalizedEmail = normalizeEmail(email);

  if (!isValidEmail(normalizedEmail) || !access_code) {
    throw createInvalidAccessError();
  }

  const client = await pool.connect();
  let transactionFinished = false;

  try {
    await client.query("BEGIN");

    const accessResult = await client.query(
      `
        SELECT
          participant_access.participant_id,
          participant_access.access_code_hash,
          participant_access.failed_attempts,
          participant_access.locked_until,
          participants.code
        FROM participant_access
        INNER JOIN participants
          ON participants.id = participant_access.participant_id
        WHERE LOWER(participant_access.email) = LOWER($1)
        FOR UPDATE OF participant_access
      `,
      [normalizedEmail],
    );
    const access = accessResult.rows[0];

    if (!access) {
      throw createInvalidAccessError();
    }

    if (access.locked_until && new Date(access.locked_until) > new Date()) {
      throw createInvalidAccessError();
    }

    const isValidAccessCode = await bcrypt.compare(
      access_code.trim().toUpperCase(),
      access.access_code_hash,
    );

    if (!isValidAccessCode) {
      const nextFailedAttempts = access.failed_attempts + 1;
      const shouldLock = nextFailedAttempts >= MAX_FAILED_ATTEMPTS;

      await client.query(
        `
          UPDATE participant_access
          SET failed_attempts = $1,
              locked_until = CASE
                WHEN $2 THEN CURRENT_TIMESTAMP + ($3 || ' minutes')::INTERVAL
                ELSE locked_until
              END,
              updated_at = CURRENT_TIMESTAMP
          WHERE participant_id = $4
        `,
        [
          nextFailedAttempts,
          shouldLock,
          LOCK_MINUTES,
          access.participant_id,
        ],
      );

      await client.query("COMMIT");
      transactionFinished = true;

      throw createInvalidAccessError();
    }

    await client.query(
      `
        UPDATE participant_access
        SET failed_attempts = 0,
            locked_until = NULL,
            updated_at = CURRENT_TIMESTAMP
        WHERE participant_id = $1
      `,
      [access.participant_id],
    );

    await client.query("COMMIT");
    transactionFinished = true;

    return {
      role: "participant",
      participant: {
        id: access.participant_id,
        code: access.code,
      },
    };
  } catch (error) {
    if (!transactionFinished) {
      await client.query("ROLLBACK");
    }

    throw error;
  } finally {
    client.release();
  }
}
